window.VehiAmb = window.VehiAmb || {};

// Firma digital sobre un <canvas> -- usada por actas de vehiculo, inspeccion
// preventiva y preoperacional. Requiere la clase CSS "firma-pad-guardada"
// (ver styles.css) para el estado bloqueado.
window.VehiAmb.firmaPad = {
    crear(canvas) {
        const ctx = canvas.getContext("2d");
        let dibujando = false;
        let tieneTrazo = false;
        let bloqueada = false;

        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#20242c";

        function posicion(event) {
            const rect = canvas.getBoundingClientRect();
            const escalaX = canvas.width / rect.width;
            const escalaY = canvas.height / rect.height;
            return {
                x: (event.clientX - rect.left) * escalaX,
                y: (event.clientY - rect.top) * escalaY
            };
        }

        function iniciar(event) {
            if (bloqueada) return;
            dibujando = true;
            tieneTrazo = true;
            // Captura el puntero en el canvas: el trazo sigue recibiendo
            // pointermove/pointerup aunque el cursor salga del rectangulo del
            // canvas a mitad de la firma (muy comun al firmar rapido cerca del
            // borde), en vez de cortarse ahi como pasaba solo con pointerleave.
            canvas.setPointerCapture?.(event.pointerId);
            const { x, y } = posicion(event);
            ctx.beginPath();
            ctx.moveTo(x, y);
            event.preventDefault();
        }

        function mover(event) {
            if (!dibujando) return;
            const { x, y } = posicion(event);
            ctx.lineTo(x, y);
            ctx.stroke();
            event.preventDefault();
        }

        function terminar(event) {
            dibujando = false;
            if (event?.pointerId !== undefined) {
                canvas.releasePointerCapture?.(event.pointerId);
            }
        }

        canvas.addEventListener("pointerdown", iniciar);
        canvas.addEventListener("pointermove", mover);
        canvas.addEventListener("pointerup", terminar);
        canvas.addEventListener("pointercancel", terminar);

        return {
            limpiar() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                tieneTrazo = false;
                bloqueada = false;
                canvas.classList.remove("firma-pad-guardada");
            },
            estaVacia() {
                return !tieneTrazo;
            },
            estaBloqueada() {
                return bloqueada;
            },
            // "Guardar firma" congela el trazo (ya no se puede seguir dibujando
            // encima por accidente) hasta que se use "Limpiar firma", que
            // desbloquea de nuevo. El guardado real del registro sigue
            // ocurriendo al enviar el formulario completo (aBlob se llama ahi).
            bloquear() {
                bloqueada = true;
                canvas.classList.add("firma-pad-guardada");
            },
            aBlob() {
                return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
            }
        };
    }
};
