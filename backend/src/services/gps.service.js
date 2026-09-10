const HttpError = require("../errors/http-error");
const gpsRepository = require("../repositories/gps.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const traccarClient = require("../providers/traccar-client");
const notificacionesService = require("./notificaciones.service");

const IMEI_REGEX = /^\d{10,17}$/;

// Ventana con la que se le pide a Traccar los eventos de cada dispositivo en
// cada corrida del sync job (ver gps-eventos-sync.job.js, cada 1 min). Se
// pide mas de 1 minuto hacia atras a proposito, para que dos corridas
// consecutivas se solapen y ningun evento se pierda por un reloj desfasado
// entre este servidor y Traccar -- gpsRepository.createEvento() lo vuelve
// idempotente (ON CONFLICT (traccar_event_id) DO NOTHING).
const VENTANA_SYNC_EVENTOS_MS = 3 * 60 * 1000;

const PERMISO_GPS_VIEW = "gps.view";

function toSafeDispositivo(dispositivo) {
  return {
    id: dispositivo.id,
    vehiculo_id: dispositivo.vehiculo_id,
    vehiculo_placa: dispositivo.vehiculo_placa,
    vehiculo_marca: dispositivo.vehiculo_marca,
    vehiculo_modelo: dispositivo.vehiculo_modelo,
    imei: dispositivo.imei,
    nombre: dispositivo.nombre,
    estado: dispositivo.estado,
    created_at: dispositivo.created_at
  };
}

function toSafePosicion(dispositivo, posicion) {
  return {
    dispositivo_id: dispositivo.id,
    vehiculo_id: dispositivo.vehiculo_id,
    vehiculo_placa: dispositivo.vehiculo_placa,
    vehiculo_marca: dispositivo.vehiculo_marca,
    vehiculo_modelo: dispositivo.vehiculo_modelo,
    latitud: posicion?.latitude ?? null,
    longitud: posicion?.longitude ?? null,
    velocidad_nudos: posicion?.speed ?? null,
    rumbo: posicion?.course ?? null,
    fecha_posicion: posicion?.fixTime ?? null,
    // "sin señal" es distinto de "sin dispositivo": el vehiculo tiene
    // tracker vinculado, pero Traccar todavia no reporto ninguna posicion
    // para el (recien vinculado, o el equipo esta apagado/sin cobertura).
    tiene_posicion: Boolean(posicion)
  };
}

async function listarDispositivos(empresaId) {
  const dispositivos = await gpsRepository.findAllDispositivos(empresaId);
  return dispositivos.map(toSafeDispositivo);
}

async function registrarDispositivo(payload, empresaId) {
  const imei = String(payload.imei || "").trim();
  const nombre = String(payload.nombre || "").trim() || null;

  if (!IMEI_REGEX.test(imei)) {
    throw new HttpError(400, "El IMEI es obligatorio y debe tener solo números (10 a 17 dígitos)");
  }

  const existente = await gpsRepository.findDispositivoByImei(imei, empresaId);
  if (existente) {
    throw new HttpError(409, `Ya existe un dispositivo registrado con el IMEI ${imei}`);
  }

  // Traccar tiene el registro automatico desactivado (por diseño: un tracker
  // desconocido no debe empezar a reportar solo porque se conecto al
  // puerto), asi que el dispositivo se da de alta aca explicitamente antes
  // de que el equipo pueda reportar posicion.
  const dispositivosTraccar = await traccarClient.listarDispositivos();
  let dispositivoTraccar = dispositivosTraccar.find((item) => item.uniqueId === imei);
  if (!dispositivoTraccar) {
    dispositivoTraccar = await traccarClient.crearDispositivo({ nombre: nombre || imei, imei });
  }

  const creado = await gpsRepository.createDispositivo({
    empresa_id: empresaId,
    vehiculo_id: null,
    traccar_device_id: dispositivoTraccar.id,
    imei,
    nombre,
    estado: "activo"
  });

  return toSafeDispositivo(creado);
}

async function asignarVehiculo(dispositivoId, vehiculoId, empresaId) {
  const dispositivo = await gpsRepository.findDispositivoById(dispositivoId, empresaId);
  if (!dispositivo) {
    throw new HttpError(404, "Dispositivo GPS no encontrado");
  }

  if (vehiculoId) {
    const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
    if (!vehiculo) {
      throw new HttpError(404, "Vehículo no encontrado");
    }

    const yaAsignado = await gpsRepository.findDispositivoByVehiculo(vehiculoId, empresaId);
    if (yaAsignado && String(yaAsignado.id) !== String(dispositivoId)) {
      throw new HttpError(409, `El vehículo ${vehiculo.placa} ya tiene otro dispositivo GPS vinculado`);
    }
  }

  const actualizado = await gpsRepository.asignarVehiculo(dispositivoId, vehiculoId || null, empresaId);
  return toSafeDispositivo(actualizado);
}

async function setEstadoDispositivo(dispositivoId, estado, empresaId) {
  const dispositivo = await gpsRepository.findDispositivoById(dispositivoId, empresaId);
  if (!dispositivo) {
    throw new HttpError(404, "Dispositivo GPS no encontrado");
  }

  const actualizado = await gpsRepository.setEstadoDispositivo(dispositivoId, estado, empresaId);
  return toSafeDispositivo(actualizado);
}

// Tablero de flota: solo vehiculos con dispositivo vinculado y activo -- un
// vehiculo sin tracker simplemente no aparece (no tiene sentido mostrarlo
// "sin señal" cuando nunca tuvo GPS).
async function listarPosicionesFlota(empresaId) {
  const dispositivos = (await gpsRepository.findAllDispositivos(empresaId))
    .filter((dispositivo) => dispositivo.estado === "activo" && dispositivo.vehiculo_id);

  if (!dispositivos.length) return [];
  if (!traccarClient.estaConfigurado()) {
    return dispositivos.map((dispositivo) => toSafePosicion(dispositivo, null));
  }

  const posiciones = await traccarClient.obtenerPosicionesActuales(dispositivos.map((d) => d.traccar_device_id));
  const posicionPorDeviceId = new Map(posiciones.map((posicion) => [posicion.deviceId, posicion]));

  return dispositivos.map((dispositivo) => toSafePosicion(dispositivo, posicionPorDeviceId.get(dispositivo.traccar_device_id)));
}

async function obtenerHistorialVehiculo(vehiculoId, empresaId, { desde, hasta }) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const dispositivo = await gpsRepository.findDispositivoByVehiculo(vehiculoId, empresaId);
  if (!dispositivo) {
    throw new HttpError(404, `El vehículo ${vehiculo.placa} no tiene un dispositivo GPS vinculado`);
  }

  const posiciones = await traccarClient.obtenerHistorialPosiciones(dispositivo.traccar_device_id, desde, hasta);
  return posiciones.map((posicion) => ({
    latitud: posicion.latitude,
    longitud: posicion.longitude,
    velocidad_nudos: posicion.speed,
    rumbo: posicion.course,
    fecha_posicion: posicion.fixTime
  }));
}

async function listarEventosVehiculo(vehiculoId, empresaId) {
  return gpsRepository.findEventosPorVehiculo(vehiculoId, empresaId);
}

// Corre desde gps-eventos-sync.job.js cada 1 min (ver env.gpsEventosSyncSchedule),
// SIN empresaId: Traccar es una sola instancia compartida por todas las
// empresas de VehiAmb, asi que recorre todos los dispositivos activos de
// todas las empresas en cada corrida.
async function sincronizarEventosGlobal() {
  if (!traccarClient.estaConfigurado()) return { revisados: 0, nuevos: 0 };

  const dispositivos = await gpsRepository.findAllDispositivosGlobal();
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - VENTANA_SYNC_EVENTOS_MS);

  let nuevos = 0;

  for (const dispositivo of dispositivos) {
    if (!dispositivo.vehiculo_id) continue;

    let eventos;
    try {
      eventos = await traccarClient.obtenerEventos(dispositivo.traccar_device_id, desde, hasta);
    } catch (error) {
      console.error(`[GpsService] No fue posible traer eventos de ${dispositivo.imei}:`, error.message);
      continue;
    }

    for (const evento of eventos) {
      const creado = await gpsRepository.createEvento({
        empresa_id: dispositivo.empresa_id,
        vehiculo_id: dispositivo.vehiculo_id,
        dispositivo_id: dispositivo.id,
        tipo_evento: evento.type,
        traccar_event_id: evento.id,
        payload: evento
      });

      if (!creado) continue;
      nuevos += 1;

      await notificacionesService.notificarUsuariosConPermiso(
        PERMISO_GPS_VIEW,
        {
          tipo: "gps_evento",
          mensaje: `${dispositivo.vehiculo_placa || dispositivo.imei}: evento GPS "${evento.type}" detectado.`,
          vehiculo_id: dispositivo.vehiculo_id,
          referencia_tipo: "gps_evento",
          referencia_id: creado.id
        },
        dispositivo.empresa_id
      ).catch((error) => {
        console.error("No fue posible notificar el evento GPS:", error.message);
      });
    }
  }

  return { revisados: dispositivos.length, nuevos };
}

module.exports = {
  listarDispositivos,
  registrarDispositivo,
  asignarVehiculo,
  setEstadoDispositivo,
  listarPosicionesFlota,
  obtenerHistorialVehiculo,
  listarEventosVehiculo,
  sincronizarEventosGlobal
};
