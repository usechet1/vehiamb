window.VehiAmb = window.VehiAmb || {};

// El dataset trata a Bogota como una ciudad mas dentro de Cundinamarca, pero
// administrativamente es su propio Distrito Capital -- se agrega como
// departamento aparte (con ella misma como unica "ciudad") para que se
// encuentre donde se busca. Usado tanto por el selector de destino del
// conductor (home.js) como por el de asignacion de rutas (asignaciones.js).
window.VehiAmb.ubicaciones = {
    async cargarDepartamentosCiudades() {
        const response = await fetch("assets/data/colombia-departamentos-ciudades.json");
        if (!response.ok) throw new Error("No se pudo cargar el listado de departamentos y ciudades");
        const departamentos = await response.json();

        return [...departamentos, { departamento: "Bogotá D.C.", ciudades: ["Bogotá D.C."] }]
            .sort((a, b) => a.departamento.localeCompare(b.departamento, "es"));
    }
};
