// Convierte la ficha del vehiculo en un paso a paso solo para el rol
// Conductor: Vehiculo -> Vencimientos -> Inspeccion -> Preoperacional ->
// Finalizar. Para el resto de roles este script no hace nada y la pagina se
// ve como siempre.
//
// Controla la visibilidad a nivel de cada <section> individual (no de los
// <div> grid que las agrupan), porque vehicle-detail.js solo muestra/oculta
// esos <div> contenedores y nunca toca el "hidden" de las secciones
// individuales -- asi no hay condicion de carrera con sus cargas asincronas.
const WIZARD_STEPS = [
    { label: "Vehículo", sections: ["vehicleDatosSection", "vehicleImagenSection", "vehicleViajesSection"] },
    { label: "Vencimientos", sections: ["vehicleVencimientosSection"] },
    { label: "Inspección", sections: ["vehicleInspeccionSection"] },
    { label: "Preoperacional", sections: ["wizardStepPreoperacional"] },
    { label: "Finalizar", sections: ["wizardStepFinalizar"] }
];

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
    // El conductor no gestiona la flota: el encabezado superior (volver,
    // titulo, acciones) es redundante con el vehicle-hero de abajo, que ya
    // muestra placa, codigo, estado y km. Solo se deja la fecha.
    document.getElementById("vehicleHeaderLeft")?.classList.add("hidden");
    document.getElementById("vehicleDetailActions")?.classList.add("hidden");

    let currentStep = 0;
    let inspeccionCompleta = false;
    let preoperacionalCompleta = false;

    function render() {
        WIZARD_STEPS.forEach((step) => {
            step.sections.forEach((id) => document.getElementById(id)?.classList.add("hidden"));
        });
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

        anteriorBtn.disabled = currentStep === 0;

        const esPasoInspeccion = currentStep === 2;
        const esPasoPreoperacional = currentStep === 3;
        const esUltimoPaso = currentStep === WIZARD_STEPS.length - 1;

        // El avance de estos dos pasos es automatico (ver listeners de
        // "inspeccion:completa"/"preoperacional:completo" mas abajo); estos
        // botones/hint quedan solo como respaldo defensivo por si ese evento
        // no llegara a dispararse.
        siguienteBtn.classList.toggle("hidden", esUltimoPaso);
        siguienteBtn.disabled = (esPasoInspeccion && !inspeccionCompleta) || (esPasoPreoperacional && !preoperacionalCompleta);

        const bloqueado = (esPasoInspeccion && !inspeccionCompleta) || (esPasoPreoperacional && !preoperacionalCompleta);
        hint.classList.toggle("hidden", !bloqueado);
        if (esPasoInspeccion && !inspeccionCompleta) {
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
        currentStep = 3;
        render();
    });

    document.addEventListener("preoperacional:completo", () => {
        preoperacionalCompleta = true;
        currentStep = WIZARD_STEPS.length - 1;
        render();
    });

    inicializarFirmaFinalizar();

    nav.classList.remove("hidden");
    actions.classList.remove("hidden");
    render();
}

// Firma unica del paso 5 -- se sube tanto a la inspeccion como al
// preoperacional (window.VehiAmb.wizardInspeccion/wizardPreoperacional, ver
// esos archivos) al confirmar "Finalizar e iniciar viaje". Ninguno de los
// dos quedo guardado antes de este punto.
function inicializarFirmaFinalizar() {
    const canvas = document.getElementById("finalizarFirmaCanvas");
    const guardarFirmaBtn = document.getElementById("finalizarGuardarFirmaButton");
    const limpiarFirmaBtn = document.getElementById("finalizarLimpiarFirmaButton");
    const finalizarBtn = document.getElementById("finalizarViajeBtn");
    const mensaje = document.getElementById("mensaje");
    if (!canvas || !finalizarBtn) return;

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

    // "Finalizar e iniciar viaje" solo es alcanzable en el ultimo paso, que ya
    // exigio completar la inspeccion y el preoperacional para llegar hasta
    // aqui -- aqui se exige ademas la firma, y recien aqui se suben los dos
    // checklists (con la misma firma) al backend. Si cualquiera de los dos
    // falla, no se muestra la animacion de cierre ni se vuelve a Inicio.
    finalizarBtn.addEventListener("click", async () => {
        if (!firmaPad.estaBloqueada() || firmaPad.estaVacia()) {
            window.VehiAmb.ui.showMessage(mensaje, "Se requiere la firma del conductor para finalizar", "error");
            return;
        }

        if (!window.VehiAmb.wizardInspeccion?.estaCompleta() || !window.VehiAmb.wizardPreoperacional?.estaCompleta()) {
            window.VehiAmb.ui.showMessage(mensaje, "Completa la inspección y el preoperacional antes de finalizar", "error");
            return;
        }

        finalizarBtn.disabled = true;

        try {
            const firmaBlob = await firmaPad.aBlob();
            await window.VehiAmb.wizardInspeccion.guardar(firmaBlob);
            await window.VehiAmb.wizardPreoperacional.guardar(firmaBlob);
        } catch (error) {
            console.error(error);
            window.VehiAmb.ui.showMessage(mensaje, error.message || "No se pudo finalizar el viaje", "error");
            finalizarBtn.disabled = false;
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
