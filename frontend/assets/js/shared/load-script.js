window.VehiAmb = window.VehiAmb || {};

// jsPDF/ExcelJS pesan varios cientos de KB cada una y solo hacen falta cuando
// el usuario efectivamente exporta -- cargarlas por CDN aqui, bajo demanda,
// en vez de con un <script> fijo en cada pagina, evita ese peso en toda
// carga que nunca llega a usar el boton de exportar.
(function () {
    const cache = new Map();

    function loadScript(src) {
        if (cache.has(src)) return cache.get(src);

        const promise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => {
                cache.delete(src);
                reject(new Error(`No se pudo cargar el script: ${src}`));
            };
            document.head.appendChild(script);
        });

        cache.set(src, promise);
        return promise;
    }

    window.VehiAmb.loadScript = loadScript;
})();
