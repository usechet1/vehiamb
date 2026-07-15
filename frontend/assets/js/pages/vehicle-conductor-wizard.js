// Convierte la ficha del vehiculo en un paso a paso solo para el rol
// Conductor: Vehiculo -> Vencimientos -> Inspeccion -> Preoperacional. Para
// el resto de roles este script no hace nada y la pagina se ve como siempre.
//
// Controla la visibilidad a nivel de cada <section> individual (no de los
// <div> grid que las agrupan), porque vehicle-detail.js solo muestra/oculta
// esos <div> contenedores y nunca toca el "hidden" de las secciones
// individuales -- asi no hay condicion de carrera con sus cargas asincronas.
const WIZARD_STEPS = [
    { label: "Vehículo", sections: ["vehicleDatosSection"] },
    { label: "Vencimientos", sections: ["vehicleVencimientosSection"] },
    { label: "Inspección", sections: ["vehicleInspeccionSection"] },
    { label: "Preoperacional", sections: ["wizardStepPreoperacional"] }
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
    // El conductor ya vio la foto del vehiculo al elegirlo en Inicio, asi
    // que no hace falta repetirla aqui.
    document.getElementById("vehicleImagenSection")?.classList.add("hidden");
    // El conductor no gestiona la flota: el encabezado superior (volver,
    // titulo, acciones) es redundante con el vehicle-hero de abajo, que ya
    // muestra placa, codigo, estado y km. Solo se deja la fecha.
    document.getElementById("vehicleHeaderLeft")?.classList.add("hidden");
    document.getElementById("vehicleDetailActions")?.classList.add("hidden");

    const preopLink = document.getElementById("abrirPreoperacionalLink");
    const preopContainer = document.querySelector("#wizardStepPreoperacional .conductor-wizard-final");
    if (preopLink && preopContainer) {
        preopContainer.prepend(preopLink);
    }

    let currentStep = 0;
    let inspeccionGuardada = false;

    function render() {
        WIZARD_STEPS.forEach((step) => {
            step.sections.forEach((id) => document.getElementById(id)?.classList.add("hidden"));
        });
        WIZARD_STEPS[currentStep].sections.forEach((id) => document.getElementById(id)?.classList.remove("hidden"));

        nav.querySelectorAll(".wizard-step").forEach((el) => {
            const stepIndex = Number(el.dataset.step) - 1;
            el.classList.toggle("is-active", stepIndex === currentStep);
            el.classList.toggle("is-completado", stepIndex < currentStep);
        });

        anteriorBtn.disabled = currentStep === 0;

        const esPasoInspeccion = currentStep === 2;
        const esUltimoPaso = currentStep === WIZARD_STEPS.length - 1;

        siguienteBtn.classList.toggle("hidden", esUltimoPaso);
        siguienteBtn.disabled = esPasoInspeccion && !inspeccionGuardada;

        hint.classList.toggle("hidden", !(esPasoInspeccion && !inspeccionGuardada));
        if (esPasoInspeccion && !inspeccionGuardada) {
            hint.textContent = "Guarda la inspección para continuar al siguiente paso.";
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

    document.addEventListener("inspeccion:guardada", () => {
        inspeccionGuardada = true;
        render();
    });

    // El preoperacional es opcional: "Finalizar e iniciar viaje" cierra el
    // flujo sin exigir que se haya abierto el link, mostrando la misma
    // animacion de cortina que el saludo de bienvenida al iniciar sesion,
    // pero en verde y de despedida, antes de volver a Inicio.
    document.getElementById("finalizarViajeBtn")?.addEventListener("click", () => {
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

    nav.classList.remove("hidden");
    actions.classList.remove("hidden");
    render();
}

document.addEventListener("DOMContentLoaded", initConductorWizard);
