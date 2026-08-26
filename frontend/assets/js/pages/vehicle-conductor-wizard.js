// Convierte la ficha del vehiculo en un paso a paso solo para el rol
// Conductor: Vehiculo -> Vencimientos -> Inspeccion -> Preoperacional ->
// Finalizar. Para el resto de roles este script no hace nada y la pagina se
// ve como siempre.
//
// Controla la visibilidad a nivel de cada <section> individual (no de los
// <div> grid que las agrupan), porque vehicle-detail.js solo muestra/oculta
// esos <div> contenedores y nunca toca el "hidden" de las secciones
// individuales -- asi no hay condicion de carrera con sus cargas asincronas.
//
// Dos variantes del flujo, segun los parametros de la URL:
// - "?asignacion=X&modo=preinspeccion" (llegada desde la tarjeta "Prepara tu
//   inspeccion de mañana" en Inicio, sin viaje creado todavia): solo
//   Vehiculo -> Vencimientos -> Inspeccion -> Guardar (guarda unicamente la
//   inspeccion, atada a la asignacion, sin preoperacional ni firma de viaje).
// - "?viaje=X&asignacion=Y" (llegada normal desde "Iniciar viaje"): si esa
//   asignacion ya tiene una inspeccion guardada de antemano, el paso
//   "Inspeccion" se salta y "Preoperacional" queda bloqueado hasta las
//   5:00am del dia de la ruta. Si no la tiene, el flujo es exactamente el de
//   siempre (fallback).
const TODAS_LAS_SECCIONES = [
    "vehicleDatosSection",
    "vehicleImagenSection",
    "vehicleVencimientosSection",
    "vehicleInspeccionSection",
    "wizardStepPreoperacional",
    "wizardStepFinalizar"
];

function hoyIsoFrontend(timeZone = "America/Bogota") {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}

function horaActualBogota(timeZone = "America/Bogota") {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());
    return Number(partes.find((parte) => parte.type === "hour")?.value);
}

// Mismo calculo que backend/src/utils/fecha-negocio.js#estaHabilitadoDesdeLasCinco
// -- duplicado aca porque este proyecto no comparte modulos entre Node y el
// navegador (mismo criterio que formatDate/escapeHtml, ya duplicados por
// pagina en varios archivos).
function estaHabilitadoDesdeLasCinco(fechaIso) {
    if (!fechaIso) return true;
    const hoy = hoyIsoFrontend();
    const fecha = String(fechaIso).slice(0, 10);
    if (hoy > fecha) return true;
    if (hoy < fecha) return false;
    return horaActualBogota() >= 5;
}

async function initConductorWizard() {
    const user = await window.VehiAmb.auth.fetchCurrentUser();
    if (user?.rol !== "Conductor") return;

    const nav = document.getElementById("conductorWizardNav");
    const actions = document.getElementById("conductorWizardActions");
    const anteriorBtn = document.getElementById("wizardAnteriorBtn");
    const siguienteBtn = document.getElementById("wizardSiguienteBtn");
    const hint = document.getElementById("wizardHint");
    if (!nav || !actions || !anteriorBtn || !siguienteBtn) return;

    document.getElementById("vehicleMantenimientosSection")?.classList.add("hidden");
    // "Ultimos viajes" tampoco es parte de ningun paso del wizard -- igual
    // que Mantenimientos, vehicle-detail.js lo desoculta solo (el conductor
    // tiene permiso trips.view), asi que hay que ocultarlo explicitamente
    // aca o quedaria visible en todos los pasos.
    document.getElementById("vehicleViajesSection")?.classList.add("hidden");
    // El conductor no gestiona la flota: el encabezado superior (volver,
    // titulo, acciones) es redundante con el vehicle-hero de abajo, que ya
    // muestra placa, codigo, estado y km. Solo se deja la fecha.
    document.getElementById("vehicleHeaderLeft")?.classList.add("hidden");
    document.getElementById("vehicleDetailActions")?.classList.add("hidden");

    const params = new URLSearchParams(window.location.search);
    const modoPreinspeccion = params.get("modo") === "preinspeccion";
    const asignacionId = params.get("asignacion") || "";

    // Si la asignacion de hoy ya tiene una inspeccion guardada de antemano
    // (hecha el dia anterior, ver home.js), el paso Inspeccion se salta y
    // Preoperacional queda atado a la hora. Si no existe o algo falla, el
    // flujo sigue exactamente igual que siempre -- este chequeo nunca
    // bloquea, solo puede saltarse un paso ya hecho.
    let inspeccionYaHecha = false;
    let fechaAsignacion = "";
    if (!modoPreinspeccion && asignacionId) {
        try {
            const asignacionHoy = await window.VehiAmb.api.getAsignacionHoy();
            if (asignacionHoy && String(asignacionHoy.id) === String(asignacionId)) {
                inspeccionYaHecha = Boolean(asignacionHoy.inspeccion_completada);
                fechaAsignacion = asignacionHoy.fecha || "";
            }
        } catch (error) {
            console.error(error);
        }
    }

    const WIZARD_STEPS = modoPreinspeccion
        ? [
            { label: "Vehículo", sections: ["vehicleDatosSection", "vehicleImagenSection"] },
            { label: "Vencimientos", sections: ["vehicleVencimientosSection"] },
            { label: "Inspección", sections: ["vehicleInspeccionSection"] },
            { label: "Guardar", sections: ["wizardStepFinalizar"] }
        ]
        : [
            { label: "Vehículo", sections: ["vehicleDatosSection", "vehicleImagenSection"] },
            { label: "Vencimientos", sections: ["vehicleVencimientosSection"] },
            ...(inspeccionYaHecha ? [] : [{ label: "Inspección", sections: ["vehicleInspeccionSection"] }]),
            { label: "Preoperacional", sections: ["wizardStepPreoperacional"] },
            { label: "Finalizar", sections: ["wizardStepFinalizar"] }
        ];

    let currentStep = 0;
    let inspeccionCompleta = false;
    let preoperacionalCompleta = false;

    function renderNav() {
        nav.innerHTML = WIZARD_STEPS.map((step, index) => `
            <li class="wizard-step" data-step="${index + 1}"><span class="wizard-step-num">${index + 1}</span> ${step.label}</li>
        `).join("");
    }

    function render() {
        TODAS_LAS_SECCIONES.forEach((id) => document.getElementById(id)?.classList.add("hidden"));
        WIZARD_STEPS[currentStep].sections.forEach((id) => document.getElementById(id)?.classList.remove("hidden"));

        nav.querySelectorAll(".wizard-step").forEach((el) => {
            const stepIndex = Number(el.dataset.step) - 1;
            const esActivo = stepIndex === currentStep;
            el.classList.toggle("is-active", esActivo);
            el.classList.toggle("is-completado", stepIndex < currentStep);
            // El nav ahora es scroll horizontal en vez de envolver a una
            // segunda fila -- sin esto el paso activo podria quedar fuera de
            // vista si el nav no cabe completo en pantalla.
            if (esActivo) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        });

        const pasoActual = WIZARD_STEPS[currentStep];
        const esPasoInspeccion = pasoActual.label === "Inspección";
        const esPasoPreoperacional = pasoActual.label === "Preoperacional";
        const esUltimoPaso = currentStep === WIZARD_STEPS.length - 1;

        anteriorBtn.disabled = currentStep === 0;

        // Preoperacional queda bloqueado hasta las 5:00am del dia de la ruta
        // SOLO cuando la inspeccion ya se hizo de antemano -- si se esta
        // haciendo todo el mismo dia (fallback), no hay nada que esperar.
        let preopBloqueadoPorHora = false;
        if (esPasoPreoperacional && inspeccionYaHecha) {
            preopBloqueadoPorHora = !estaHabilitadoDesdeLasCinco(fechaAsignacion);
            document.getElementById("preopBloqueadoAviso")?.classList.toggle("hidden", !preopBloqueadoPorHora);
            document.getElementById("preopContenido")?.classList.toggle("hidden", preopBloqueadoPorHora);
        }

        // El avance de Inspeccion/Preoperacional es automatico (ver
        // listeners de "inspeccion:completa"/"preoperacional:completo" mas
        // abajo); estos botones/hint quedan solo como respaldo defensivo
        // por si ese evento no llegara a dispararse.
        siguienteBtn.classList.toggle("hidden", esUltimoPaso);
        siguienteBtn.disabled = (esPasoInspeccion && !inspeccionCompleta) || (esPasoPreoperacional && (!preoperacionalCompleta || preopBloqueadoPorHora));

        const bloqueado = (esPasoInspeccion && !inspeccionCompleta) || (esPasoPreoperacional && (!preoperacionalCompleta || preopBloqueadoPorHora));
        hint.classList.toggle("hidden", !bloqueado);
        if (esPasoPreoperacional && preopBloqueadoPorHora) {
            hint.textContent = "El preoperacional se habilita a las 5:00am del día de la ruta.";
        } else if (esPasoInspeccion && !inspeccionCompleta) {
            hint.textContent = "Marca todos los ítems de la inspección para continuar.";
        } else if (esPasoPreoperacional && !preoperacionalCompleta) {
            hint.textContent = "Responde todas las preguntas del preoperacional para continuar.";
        }

        document.getElementById("vehicleHero")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    anteriorBtn.addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep -= 1;
            render();
        }
    });

    siguienteBtn.addEventListener("click", () => {
        if (currentStep < WIZARD_STEPS.length - 1) {
            currentStep += 1;
            render();
        }
    });

    // Ni la inspeccion ni el preoperacional se guardan ya al completarse --
    // solo marcan items/preguntas localmente (ver vehicle-inspeccion.js /
    // vehicle-preoperacional.js) y avisan aqui para saltar automaticamente
    // al siguiente paso, sin pedirle al conductor un click extra.
    document.addEventListener("inspeccion:completa", () => {
        inspeccionCompleta = true;
        const siguienteLabel = modoPreinspeccion ? "Guardar" : "Preoperacional";
        const idx = WIZARD_STEPS.findIndex((step) => step.label === siguienteLabel);
        if (idx !== -1) currentStep = idx;
        render();
    });

    document.addEventListener("preoperacional:completo", () => {
        preoperacionalCompleta = true;
        currentStep = WIZARD_STEPS.length - 1;
        render();
    });

    // "completo": flujo normal, Finalizar guarda inspeccion + preoperacional.
    // "solo_inspeccion": modo preinspeccion, el ultimo paso ("Guardar") solo
    // guarda la inspeccion, sin viaje ni preoperacional.
    // "solo_preoperacional": la inspeccion de esta asignacion ya se guardo
    // ayer -- Finalizar solo debe exigir/guardar el preoperacional, no
    // volver a pedir la inspeccion (que no tiene datos marcados en esta
    // sesion).
    const modoFirma = modoPreinspeccion ? "solo_inspeccion" : (inspeccionYaHecha ? "solo_preoperacional" : "completo");
    inicializarFirmaFinalizar(modoFirma);

    nav.classList.remove("hidden");
    actions.classList.remove("hidden");
    renderNav();
    render();
}

// Firma unica del ultimo paso -- se sube a la inspeccion y/o al
// preoperacional (window.VehiAmb.wizardInspeccion/wizardPreoperacional, ver
// esos archivos) segun el modo. Ninguno de los dos queda guardado antes de
// este punto.
function inicializarFirmaFinalizar(modo = "completo") {
    const canvas = document.getElementById("finalizarFirmaCanvas");
    const guardarFirmaBtn = document.getElementById("finalizarGuardarFirmaButton");
    const limpiarFirmaBtn = document.getElementById("finalizarLimpiarFirmaButton");
    const finalizarBtn = document.getElementById("finalizarViajeBtn");
    const tituloEl = document.getElementById("finalizarTitulo");
    const descripcionEl = document.getElementById("finalizarDescripcion");
    const mensaje = document.getElementById("mensaje");
    if (!canvas || !finalizarBtn) return;

    if (modo === "solo_inspeccion") {
        if (tituloEl) tituloEl.textContent = "Guardar inspección";
        if (descripcionEl) descripcionEl.textContent = "Ya completaste la inspección de mañana. Firma para guardarla.";
        finalizarBtn.textContent = "Guardar inspección";
    } else if (modo === "solo_preoperacional") {
        if (descripcionEl) descripcionEl.textContent = "Ya completaste el preoperacional (la inspección la hiciste ayer). Firma para confirmar e iniciar el viaje.";
    }

    const firmaPad = window.VehiAmb.firmaPad.crear(canvas);

    function actualizarBotonFinalizar() {
        finalizarBtn.disabled = !firmaPad.estaBloqueada();
    }

    guardarFirmaBtn?.addEventListener("click", () => {
        if (firmaPad.estaVacia()) {
            window.VehiAmb.ui.showMessage(mensaje, "Primero dibuja la firma antes de guardarla", "error");
            return;
        }
        firmaPad.bloquear();
        window.VehiAmb.ui.showMessage(mensaje, "Firma guardada");
        actualizarBotonFinalizar();
    });

    limpiarFirmaBtn?.addEventListener("click", () => {
        firmaPad.limpiar();
        actualizarBotonFinalizar();
    });

    const necesitaInspeccion = modo !== "solo_preoperacional";
    const necesitaPreoperacional = modo !== "solo_inspeccion";

    finalizarBtn.addEventListener("click", async () => {
        if (!firmaPad.estaBloqueada() || firmaPad.estaVacia()) {
            window.VehiAmb.ui.showMessage(mensaje, "Se requiere la firma del conductor para continuar", "error");
            return;
        }

        if (necesitaInspeccion && !window.VehiAmb.wizardInspeccion?.estaCompleta()) {
            window.VehiAmb.ui.showMessage(mensaje, "Completa la inspección antes de guardar", "error");
            return;
        }
        if (necesitaPreoperacional && !window.VehiAmb.wizardPreoperacional?.estaCompleta()) {
            window.VehiAmb.ui.showMessage(mensaje, "Completa el preoperacional antes de finalizar", "error");
            return;
        }

        finalizarBtn.disabled = true;

        try {
            const firmaBlob = await firmaPad.aBlob();
            if (necesitaInspeccion) await window.VehiAmb.wizardInspeccion.guardar(firmaBlob);
            if (necesitaPreoperacional) await window.VehiAmb.wizardPreoperacional.guardar(firmaBlob);
        } catch (error) {
            console.error(error);
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo guardar", "error");
            finalizarBtn.disabled = false;
            return;
        }

        // Modo preinspeccion: no hay viaje que iniciar, solo se guardo la
        // inspeccion de mañana -- mensaje corto y de vuelta a Inicio, sin la
        // animacion de "viaje iniciado" que no aplica aca.
        if (modo === "solo_inspeccion") {
            window.VehiAmb.ui.showMessage(mensaje, "Inspección guardada. Vuelve mañana a las 5:00am para continuar con el preoperacional.");
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1800);
            return;
        }

        // Misma animacion de cortina que el saludo de bienvenida al iniciar
        // sesion, pero en verde y de despedida, antes de volver a Inicio.
        const overlay = document.getElementById("viajeIniciadoCurtain");
        if (!overlay) {
            window.location.href = "index.html";
            return;
        }

        overlay.classList.remove("hidden");
        setTimeout(() => {
            overlay.classList.add("curtain-out");
            overlay.addEventListener("animationend", () => {
                window.location.href = "index.html";
            }, { once: true });
        }, 1500);
    });
}

document.addEventListener("DOMContentLoaded", initConductorWizard);
