(function () {
    const APP_NAME = "VehiAmb";
    const LOGO_PATH = "img/vehiamb.png";
    const MARGIN_X = 40;
    const PAGE_BOTTOM_LIMIT = 760;
    const FOOTER_TEXT = () => `Generado por ${APP_NAME} - Software propio de Ambientes Cerámicos - el ${new Date().toLocaleString("es-CO")}`;

    const tiposMantenimiento = {
        revision: "Revisión general",
        preventivo: "Preventivo",
        correctivo: "Correctivo",
        cambio_aceite: "Cambio de aceite",
        frenos: "Frenos",
        llantas: "Llantas",
        otro: "Otro"
    };

    const tiposDocumento = {
        tecnomecanica: "Tecnomecánica",
        soat: "SOAT",
        seguro: "Seguro",
        tarjeta_operacion: "Tarjeta de operación",
        otro: "Otro"
    };

    const ESTADO_VEHICULO_LABELS = {
        activo: "Activo",
        reparacion: "En reparación",
        fuera_servicio: "Fuera de servicio"
    };

    const ESTADO_SIMIT_LABELS = {
        nunca_consultado: "Nunca consultado",
        sin_multas: "Sin multas",
        con_multas: "Con multas",
        cobro_coactivo: "Cobro coactivo",
        acuerdo_pago: "Acuerdo de pago",
        desconocido: "Desconocido / error"
    };

    function safe(value, fallback = "No registrado") {
        if (value === null || value === undefined || value === "") return fallback;
        return String(value);
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }).format(Number(value || 0));
    }

    function formatKm(value) {
        return `${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })} km`;
    }

    function formatDateTime(value) {
        if (!value) return "Nunca";
        return new Date(value).toLocaleString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getVehicleImageSource(vehiculo) {
        const rawSource = vehiculo.imagen_url
            || vehiculo.imagen
            || vehiculo.foto_url
            || vehiculo.foto
            || vehiculo.image_url
            || vehiculo.image;

        if (!rawSource) return "";
        if (/^(https?:|data:|blob:)/i.test(rawSource)) return rawSource;
        return window.VehiAmb?.api?.getAssetUrl
            ? window.VehiAmb.api.getAssetUrl(rawSource)
            : rawSource;
    }

    async function addVehicleImage(doc, vehiculo, { x, y, maxWidth, maxHeight }) {
        const imageSource = getVehicleImageSource(vehiculo);
        if (!imageSource) return y;

        try {
            const { dataUrl, width, height } = await window.VehiAmb.pdfExport.loadImageAsJpegDataUrl(imageSource);
            const scale = Math.min(maxWidth / width, maxHeight / height, 1);
            const renderWidth = width * scale;
            const renderHeight = height * scale;

            doc.addImage(dataUrl, "JPEG", x, y, renderWidth, renderHeight);
            return y + renderHeight;
        } catch (error) {
            console.error("No se pudo incluir la imagen del vehículo en el PDF:", error);
            return y;
        }
    }

    function buildFileName(vehiculo) {
        const placa = String(vehiculo.placa || "SINPLACA").replace(/\s+/g, "").toUpperCase();
        const fecha = new Date().toISOString().slice(0, 10);
        return `Hoja_de_vida_${placa}_${fecha}.pdf`;
    }

    function makeLayout(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 40;

        function ensureSpace(next) {
            if (y + next > PAGE_BOTTOM_LIMIT) {
                doc.addPage();
                y = 40;
            }
        }

        function sectionTitle(text) {
            ensureSpace(20);
            doc.setFontSize(12);
            doc.setFont(undefined, "bold");
            doc.setTextColor(178, 31, 45);
            doc.text(text, MARGIN_X, y);
            doc.setTextColor(24, 32, 43);
            y += 18;
        }

        function row(label, value) {
            ensureSpace(16);
            doc.setFontSize(10);
            doc.setFont(undefined, "bold");
            doc.text(`${label}:`, MARGIN_X, y);
            doc.setFont(undefined, "normal");
            doc.text(safe(value), MARGIN_X + 150, y, { maxWidth: pageWidth - MARGIN_X * 2 - 150 });
            y += 16;
        }

        function spacer(amount = 8) {
            y += amount;
        }

        return {
            get y() { return y; },
            set y(value) { y = value; },
            pageWidth,
            ensureSpace,
            sectionTitle,
            row,
            spacer
        };
    }

    async function addHeader(doc, layout, vehiculo) {
        try {
            const logoDataUrl = await window.VehiAmb.pdfExport.loadAsDataUrl(LOGO_PATH);
            doc.addImage(logoDataUrl, "PNG", MARGIN_X, layout.y, 90, 44);
        } catch (error) {
            console.error("No se pudo cargar el logo para el PDF:", error);
        }

        const vehicleName = `${vehiculo.marca || ""} ${vehiculo.modelo || ""}`.trim();

        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.setTextColor(24, 32, 43);
        doc.text("Hoja de vida del vehículo", layout.pageWidth - MARGIN_X, layout.y + 18, { align: "right" });
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.setTextColor(105, 115, 134);
        doc.text(`${vehicleName || "Vehículo"} · ${safe(vehiculo.placa, "SIN PLACA")}`, layout.pageWidth - MARGIN_X, layout.y + 34, { align: "right" });
        doc.setTextColor(24, 32, 43);

        layout.y += 64;
        doc.setDrawColor(220, 226, 234);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(24);
    }

    function addMantenimientosTable(doc, layout, mantenimientos) {
        layout.sectionTitle("Mantenimientos y revisiones");

        if (!mantenimientos || !mantenimientos.length) {
            doc.setFontSize(10);
            doc.setFont(undefined, "normal");
            doc.text("Este vehículo aún no tiene mantenimientos registrados.", MARGIN_X, layout.y);
            layout.spacer(20);
            return;
        }

        const colX = [MARGIN_X, MARGIN_X + 65, MARGIN_X + 175, MARGIN_X + 280, MARGIN_X + 360, MARGIN_X + 460];

        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Fecha", colX[0], layout.y);
        doc.text("Tipo", colX[1], layout.y);
        doc.text("Detalle", colX[2], layout.y);
        doc.text("Km", colX[3], layout.y);
        doc.text("Valor", colX[4], layout.y);
        doc.text("Hecho por", colX[5], layout.y);
        layout.spacer(6);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);
        doc.setFont(undefined, "normal");

        mantenimientos.forEach((item) => {
            layout.ensureSpace(16);
            doc.text(window.VehiAmb.pdfExport.formatDateForPdf(item.fecha), colX[0], layout.y);
            doc.text(safe(tiposMantenimiento[item.tipo] || item.tipo), colX[1], layout.y, { maxWidth: 105 });
            doc.text(safe(item.descripcion, "Sin detalle"), colX[2], layout.y, { maxWidth: 75 });
            doc.text(formatKm(item.kilometraje), colX[3], layout.y);
            doc.text(formatCurrency(item.valor), colX[4], layout.y);
            doc.text(safe(item.hecho_por), colX[5], layout.y, { maxWidth: 90 });
            layout.spacer(16);
        });

        layout.spacer(8);
    }

    function addDocumentosTable(doc, layout, documentos) {
        layout.sectionTitle("Vencimientos");

        if (!documentos || !documentos.length) {
            doc.setFontSize(10);
            doc.setFont(undefined, "normal");
            doc.text("Este vehículo aún no tiene vencimientos agendados.", MARGIN_X, layout.y);
            layout.spacer(20);
            return;
        }

        const colX = [MARGIN_X, MARGIN_X + 140, MARGIN_X + 250, MARGIN_X + 360];

        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Tipo", colX[0], layout.y);
        doc.text("Número", colX[1], layout.y);
        doc.text("Expedición", colX[2], layout.y);
        doc.text("Vencimiento", colX[3], layout.y);
        layout.spacer(6);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);
        doc.setFont(undefined, "normal");

        documentos.forEach((item) => {
            layout.ensureSpace(16);
            doc.text(safe(tiposDocumento[item.tipo] || item.tipo), colX[0], layout.y, { maxWidth: 130 });
            doc.text(safe(item.numero_documento), colX[1], layout.y, { maxWidth: 100 });
            doc.text(window.VehiAmb.pdfExport.formatDateForPdf(item.fecha_expedicion), colX[2], layout.y);
            doc.text(window.VehiAmb.pdfExport.formatDateForPdf(item.fecha_vencimiento), colX[3], layout.y);
            layout.spacer(16);
        });

        layout.spacer(8);
    }

    function addComparendosTable(doc, layout, comparendos) {
        layout.ensureSpace(20);
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Detalle de comparendos", MARGIN_X, layout.y);
        layout.spacer(14);

        if (!comparendos || !comparendos.length) {
            doc.setFont(undefined, "normal");
            doc.text("No hay comparendos registrados en la última consulta.", MARGIN_X, layout.y);
            layout.spacer(16);
            return;
        }

        const colX = [MARGIN_X, MARGIN_X + 100, MARGIN_X + 150, MARGIN_X + 340, MARGIN_X + 420];

        doc.setFont(undefined, "bold");
        doc.text("Número", colX[0], layout.y);
        doc.text("Fecha", colX[1], layout.y);
        doc.text("Descripción", colX[2], layout.y);
        doc.text("Valor", colX[3], layout.y);
        doc.text("Estado", colX[4], layout.y);
        layout.spacer(6);
        doc.line(MARGIN_X, layout.y, layout.pageWidth - MARGIN_X, layout.y);
        layout.spacer(14);
        doc.setFont(undefined, "normal");

        comparendos.forEach((item) => {
            layout.ensureSpace(16);
            doc.text(safe(item.numero_comparendo), colX[0], layout.y, { maxWidth: 45 });
            doc.text(item.fecha_infraccion ? window.VehiAmb.pdfExport.formatDateForPdf(item.fecha_infraccion) : "Sin fecha", colX[1], layout.y);
            doc.text(safe(item.descripcion, "Sin descripción"), colX[2], layout.y, { maxWidth: 185 });
            doc.text(formatCurrency(item.valor), colX[3], layout.y);
            doc.text(safe(item.estado), colX[4], layout.y);
            layout.spacer(16);
        });

        layout.spacer(8);
    }

    function addSimitSection(doc, layout, simit) {
        layout.sectionTitle("Estado SIMIT");

        if (!simit) {
            doc.setFontSize(10);
            doc.setFont(undefined, "normal");
            doc.text("No fue posible obtener el estado SIMIT de este vehículo.", MARGIN_X, layout.y);
            layout.spacer(20);
            return;
        }

        const ultima = simit.historial?.[0];
        layout.row("Estado actual", ESTADO_SIMIT_LABELS[simit.estado] || simit.estado);
        layout.row("Comparendos vigentes", ultima?.total_comparendos ?? 0);
        layout.row("Valor total", formatCurrency(ultima?.valor_total));
        layout.row("Última consulta", formatDateTime(ultima?.fecha_consulta));
        layout.spacer(8);

        addComparendosTable(doc, layout, simit.detalle?.comparendos);
    }

    function addFooter(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        const generado = FOOTER_TEXT();

        for (let page = 1; page <= pageCount; page += 1) {
            doc.setPage(page);
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(120, 128, 140);
            doc.text(generado, MARGIN_X, pageHeight - 24);
        }
    }

    async function exportHojaVidaPdf({ vehiculo, mantenimientos, documentos, simit }) {
        if (!vehiculo) {
            throw new Error("No hay un vehículo cargado para exportar");
        }

        const doc = window.VehiAmb.pdfExport.createDocument();
        const layout = makeLayout(doc);

        await addHeader(doc, layout, vehiculo);

        layout.sectionTitle("Información general");
        const infoStartY = layout.y;
        layout.row("Código interno", vehiculo.codigo_interno);
        layout.row("Placa", vehiculo.placa);
        layout.row("Estado", ESTADO_VEHICULO_LABELS[vehiculo.estado] || vehiculo.estado);
        layout.row("Tipo de vehículo", vehiculo.tipo_vehiculo);
        layout.row("Tipo de carrocería", vehiculo.tipo_carroceria);
        layout.row("Marca", vehiculo.marca);
        layout.row("Línea", vehiculo.modelo);
        layout.row("Modelo", vehiculo.anio);
        layout.row("Color", vehiculo.color);
        layout.row("Combustible", vehiculo.combustible);
        layout.row("Cilindraje", vehiculo.cilindraje);
        layout.row("Capacidad de carga", vehiculo.capacidad_carga);
        layout.row("Número de chasis (VIN)", vehiculo.numero_chasis);
        layout.row("Número de motor", vehiculo.numero_motor);
        layout.row("Kilometraje actual", formatKm(vehiculo.kilometraje_actual));
        const infoEndY = layout.y;

        const imageX = MARGIN_X + 300;
        const imageEndY = await addVehicleImage(doc, vehiculo, {
            x: imageX,
            y: infoStartY,
            maxWidth: layout.pageWidth - MARGIN_X - imageX,
            maxHeight: infoEndY - infoStartY
        });

        layout.y = Math.max(infoEndY, imageEndY);
        layout.spacer();

        addMantenimientosTable(doc, layout, mantenimientos);
        addDocumentosTable(doc, layout, documentos);
        addSimitSection(doc, layout, simit);

        addFooter(doc);

        doc.save(buildFileName(vehiculo));
    }

    window.VehiAmb = window.VehiAmb || {};
    window.VehiAmb.vehiculoExport = { exportHojaVidaPdf };
})();
