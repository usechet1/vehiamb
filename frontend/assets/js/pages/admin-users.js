const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const userForm = document.getElementById("userForm");
const userId = document.getElementById("userId");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userCelular = document.getElementById("userCelular");
const userPassword = document.getElementById("userPassword");
const userRole = document.getElementById("userRole");
const userActive = document.getElementById("userActive");
const userFormMode = document.getElementById("userFormMode");
const cancelEditButton = document.getElementById("cancelEditButton");
const usersList = document.getElementById("usersList");
const usersKpisGrid = document.getElementById("usersKpisGrid");
const usersRoleChips = document.getElementById("usersRoleChips");
const userSearchInput = document.getElementById("userSearchInput");
const rolesPermissions = document.getElementById("rolesPermissions");
const toggleUserPasswordButton = document.getElementById("toggleUserPasswordButton");
const userPasswordIconEye = toggleUserPasswordButton.querySelector(".icon-eye");
const userPasswordIconEyeOff = toggleUserPasswordButton.querySelector(".icon-eye-off");
const userPhoto = document.getElementById("userPhoto");
const userPhotoDropzone = document.getElementById("userPhotoDropzone");
const userPhotoPlaceholder = document.getElementById("userPhotoPlaceholder");
const userPhotoPreview = document.getElementById("userPhotoPreview");
const userFotoPosicion = document.getElementById("userFotoPosicion");
const userPhotoActions = document.getElementById("userPhotoActions");
const userPhotoChangeButton = document.getElementById("userPhotoChangeButton");
const userPhotoCenterButton = document.getElementById("userPhotoCenterButton");

let usersState = [];
let rolesState = [];
let permissionsState = [];
let usersRoleActiva = "";

function buildEmail(rawValue) {
    return String(rawValue || "").trim().toLowerCase();
}

function hideUserPassword() {
    userPassword.type = "password";
    toggleUserPasswordButton.setAttribute("aria-label", "Mostrar contraseña");
    toggleUserPasswordButton.setAttribute("aria-pressed", "false");
    userPasswordIconEye.classList.remove("hidden");
    userPasswordIconEyeOff.classList.add("hidden");
}

toggleUserPasswordButton.addEventListener("click", () => {
    const isVisible = userPassword.type === "text";

    userPassword.type = isVisible ? "password" : "text";
    toggleUserPasswordButton.setAttribute("aria-label", isVisible ? "Mostrar contraseña" : "Ocultar contraseña");
    toggleUserPasswordButton.setAttribute("aria-pressed", String(!isVisible));
    userPasswordIconEye.classList.toggle("hidden", !isVisible);
    userPasswordIconEyeOff.classList.toggle("hidden", isVisible);
});

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// El encuadre se guarda como "X% Y%" (mismo formato que la propiedad CSS
// object-position, ver .avatar-dropzone-preview/.user-avatar img) para
// poder aplicarlo tal cual como estilo inline sin traducirlo cada vez.
function setFotoPosicion(x, y) {
    const clampedX = Math.min(100, Math.max(0, x));
    const clampedY = Math.min(100, Math.max(0, y));
    userFotoPosicion.value = `${clampedX.toFixed(1)}% ${clampedY.toFixed(1)}%`;
    userPhotoPreview.style.objectPosition = userFotoPosicion.value;
}

function parseFotoPosicion(value) {
    const match = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(String(value || "").trim());
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 50, y: 50 };
}

function resetPhotoField() {
    userPhoto.value = "";
    userPhotoPreview.removeAttribute("src");
    window.VehiAmb.ui.hide(userPhotoPreview);
    window.VehiAmb.ui.show(userPhotoPlaceholder);
    window.VehiAmb.ui.hide(userPhotoActions);
    setFotoPosicion(50, 50);
}

// Arrastrar la foto dentro del circulo (Pointer Events: funciona igual con
// mouse y con touch) para elegir manualmente que parte queda visible --
// antes siempre se recortaba centrada, sin forma de ajustarla.
// setPointerCapture asegura que el arrastre siga funcionando aunque el
// cursor se salga del circulo mientras se mueve.
let arrastrandoFoto = false;
let arrastreInicio = { x: 0, y: 0, posX: 50, posY: 50 };

userPhotoPreview.addEventListener("pointerdown", (event) => {
    if (userPhotoPreview.classList.contains("hidden")) return;

    arrastrandoFoto = true;
    const posicionActual = parseFotoPosicion(userFotoPosicion.value);
    arrastreInicio = { x: event.clientX, y: event.clientY, posX: posicionActual.x, posY: posicionActual.y };
    userPhotoPreview.setPointerCapture(event.pointerId);
    event.preventDefault();
});

userPhotoPreview.addEventListener("pointermove", (event) => {
    if (!arrastrandoFoto) return;

    // La foto "sigue" al cursor (se arrastra el contenido, no la ventana de
    // recorte) -- por eso el delta se resta: mover el mouse hacia la
    // derecha debe revelar mas del lado izquierdo de la foto, que es
    // object-position-x bajo (ver la nota en styles.css de object-position).
    const rect = userPhotoPreview.getBoundingClientRect();
    const deltaXPct = ((event.clientX - arrastreInicio.x) / rect.width) * 100;
    const deltaYPct = ((event.clientY - arrastreInicio.y) / rect.height) * 100;
    setFotoPosicion(arrastreInicio.posX - deltaXPct, arrastreInicio.posY - deltaYPct);
});

function terminarArrastreFoto(event) {
    if (!arrastrandoFoto) return;
    arrastrandoFoto = false;
    if (userPhotoPreview.hasPointerCapture?.(event.pointerId)) {
        userPhotoPreview.releasePointerCapture(event.pointerId);
    }
}

userPhotoPreview.addEventListener("pointerup", terminarArrastreFoto);
userPhotoPreview.addEventListener("pointercancel", terminarArrastreFoto);

userPhotoChangeButton.addEventListener("click", () => userPhoto.click());
userPhotoCenterButton.addEventListener("click", () => setFotoPosicion(50, 50));

function resetForm() {
    userForm.reset();
    userId.value = "";
    userActive.checked = true;
    userPassword.required = true;
    userFormMode.textContent = "Nuevo usuario";
    hideUserPassword();
    resetPhotoField();
    fillRoles();
}

function fillRoles() {
    userRole.innerHTML = '<option value="">Selecciona un rol</option>';

    rolesState.forEach((role) => {
        if (!role.activo) return;

        const option = document.createElement("option");
        option.value = role.id;
        option.textContent = role.nombre;
        userRole.appendChild(option);
    });
}

// Un usuario puede tener asignado un rol que despues se desactivo. Si no se
// agrega como opcion, el select queda vacio al editar y no se ve que rol
// tiene realmente (ver usuarios.service.js#resolveRole para el mismo caso
// en el backend).
function ensureRoleOption(roleId) {
    if (!roleId) return;

    const yaExiste = [...userRole.options].some((option) => option.value === String(roleId));
    if (yaExiste) return;

    const role = rolesState.find((item) => String(item.id) === String(roleId));
    const option = document.createElement("option");
    option.value = roleId;
    option.textContent = role ? `${role.nombre} (inactivo)` : "Rol inactivo";
    userRole.appendChild(option);
}

function roleNameById(roleId) {
    return rolesState.find((role) => String(role.id) === String(roleId))?.nombre || "Sin rol";
}

function userRoleName(user) {
    return user.rol || roleNameById(user.role_id);
}

function renderUsersKpis() {
    const activos = usersState.filter((user) => user.activo).length;

    usersKpisGrid.innerHTML = `
        <div class="kpi-card" style="--kpi-accent: var(--color-ink-soft)">
            <div class="kpi-label">Total usuarios</div>
            <div class="kpi-value">${usersState.length}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-success)">
            <div class="kpi-label">Activos</div>
            <div class="kpi-value">${activos}</div>
        </div>
        <div class="kpi-card" style="--kpi-accent: var(--color-primary)">
            <div class="kpi-label">Inactivos</div>
            <div class="kpi-value">${usersState.length - activos}</div>
        </div>
    `;
}

// Chips "Todos (27)" + uno por rol con su conteo -- con 20+ usuarios entre
// varios roles, el buscador por nombre/correo solo no resuelve "muestrame
// solo los conductores". Reusa .notif-filtro-chip (mismo look que las
// categorias del centro de notificaciones).
function renderUsersRoleChips() {
    const counts = {};
    usersState.forEach((user) => {
        const rol = userRoleName(user);
        counts[rol] = (counts[rol] || 0) + 1;
    });

    const roles = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const chipTodos = `<button type="button" class="notif-filtro-chip${usersRoleActiva ? "" : " active"}" data-users-rol="">Todos (${usersState.length})</button>`;
    const chipsRoles = roles.map((rol) => {
        const activa = usersRoleActiva === rol;
        return `<button type="button" class="notif-filtro-chip${activa ? " active" : ""}" data-users-rol="${escapeHtml(rol)}">${escapeHtml(rol)} (${counts[rol]})</button>`;
    }).join("");

    usersRoleChips.innerHTML = chipTodos + chipsRoles;
}

function matchesUserRole(user) {
    return !usersRoleActiva || userRoleName(user) === usersRoleActiva;
}

function matchesUserSearch(user) {
    const termino = userSearchInput.value.trim().toLowerCase();
    if (!termino) return true;

    return String(user.nombre || "").toLowerCase().includes(termino)
        || String(user.email || "").toLowerCase().includes(termino);
}

function applyUserFilters() {
    renderUsers(usersState.filter((user) => matchesUserRole(user) && matchesUserSearch(user)));
}

function renderUsers(rows) {
    if (!rows.length) {
        usersList.innerHTML = usersState.length
            ? '<p class="dash-empty">Ningún usuario coincide con estos filtros</p>'
            : '<p class="dash-empty">Aún no hay usuarios registrados</p>';
        return;
    }

    usersList.innerHTML = rows.map((user) => `
        <article class="admin-user-item">
            <div class="record-top">
                <div class="user-list-identity">
                    <div class="user-avatar">
                        ${user.foto_url
                            ? `<img src="${window.VehiAmb.api.getAssetUrl(user.foto_url)}" alt="" style="object-position: ${escapeHtml(user.foto_posicion || "50% 50%")}">`
                            : window.getInitials(user.nombre)}
                    </div>
                    <div>
                        <span class="record-title">${escapeHtml(user.nombre)}</span>
                        <span class="record-sub">${escapeHtml(user.email)}</span>
                    </div>
                </div>
                <span class="badge ${user.activo ? "badge-verde" : "badge-rojo"}">
                    ${user.activo ? "Activo" : "Inactivo"}
                </span>
            </div>
            <div class="record-meta">
                <span class="pill">${escapeHtml(userRoleName(user))}</span>
            </div>
            <div class="admin-user-actions">
                <button type="button" class="btn-secondary" data-action="edit" data-id="${user.id}">Editar</button>
                <button type="button" class="btn-secondary" data-action="toggle" data-id="${user.id}" data-active="${!user.activo}">
                    ${user.activo ? "Desactivar" : "Activar"}
                </button>
            </div>
        </article>
    `).join("");
}

function renderRolePermissions() {
    if (!rolesState.length) {
        rolesPermissions.innerHTML = '<p class="dash-empty">No hay roles configurados</p>';
        return;
    }

    rolesPermissions.innerHTML = rolesState.map((role) => `
        <article class="role-permission-card">
            <div class="record-top">
                <div>
                    <span class="record-title">${escapeHtml(role.nombre)}</span>
                    <span class="record-sub">${escapeHtml(role.descripcion || "Rol del sistema")}</span>
                </div>
                <span class="badge ${role.activo ? "badge-verde" : "badge-rojo"}">
                    ${role.activo ? "Activo" : "Inactivo"}
                </span>
            </div>
            <form class="role-permission-form" data-role-id="${role.id}">
                ${renderPermissionGroups(role)}
                <button type="submit" class="btn-secondary">Guardar permisos</button>
            </form>
        </article>
    `).join("");
}

function renderPermissionGroups(role) {
    const rolePermissionIds = new Set((role.permisos || []).map((permission) => String(permission.id)));
    const grouped = permissionsState.reduce((acc, permission) => {
        const moduleName = permission.modulo || "General";
        acc[moduleName] = acc[moduleName] || [];
        acc[moduleName].push(permission);
        return acc;
    }, {});

    return Object.entries(grouped).map(([moduleName, permissions]) => `
        <fieldset class="permission-group">
            <legend>${escapeHtml(moduleName)}</legend>
            ${permissions.map((permission) => `
                <label class="permission-check">
                    <input
                        type="checkbox"
                        name="permission"
                        value="${permission.id}"
                        ${rolePermissionIds.has(String(permission.id)) ? "checked" : ""}
                    >
                    <span>${escapeHtml(permission.descripcion || permission.codigo)}</span>
                </label>
            `).join("")}
        </fieldset>
    `).join("");
}

function editUser(id) {
    const user = usersState.find((item) => String(item.id) === String(id));
    if (!user) return;

    userId.value = user.id;
    userName.value = user.nombre || "";
    userEmail.value = user.email || "";
    userCelular.value = user.celular || "";
    userPassword.value = "";
    userPassword.required = false;
    hideUserPassword();
    ensureRoleOption(user.role_id);
    userRole.value = user.role_id || "";
    userActive.checked = Boolean(user.activo);
    userFormMode.textContent = "Editar usuario";

    if (user.foto_url) {
        userPhotoPreview.src = window.VehiAmb.api.getAssetUrl(user.foto_url);
        window.VehiAmb.ui.show(userPhotoPreview);
        window.VehiAmb.ui.hide(userPhotoPlaceholder);
        window.VehiAmb.ui.show(userPhotoActions);
        const posicion = parseFotoPosicion(user.foto_posicion);
        setFotoPosicion(posicion.x, posicion.y);
    } else {
        resetPhotoField();
    }

    userName.focus();
}

async function toggleUser(id, active) {
    if (!active) {
        const user = usersState.find((item) => String(item.id) === String(id));
        const confirmado = await window.VehiAmb.ui.confirm({
            title: "Desactivar usuario",
            message: `${user?.nombre || "Este usuario"} perderá acceso al sistema de inmediato.`,
            confirmText: "Desactivar"
        });
        if (!confirmado) return;
    }

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.setUsuarioActivo(id, active);
        window.VehiAmb.ui.showMessage(mensaje, active ? "Usuario activado" : "Usuario desactivado");
        await loadUsers();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible actualizar el usuario", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

function updatePhotoPreview() {
    const file = userPhoto.files?.[0];

    if (!file) {
        resetPhotoField();
        return;
    }

    userPhotoPreview.src = URL.createObjectURL(file);
    window.VehiAmb.ui.show(userPhotoPreview);
    window.VehiAmb.ui.hide(userPhotoPlaceholder);
    window.VehiAmb.ui.show(userPhotoActions);
    // Foto nueva: se vuelve a centrar en vez de conservar el encuadre de la
    // foto anterior (que ya no aplica a esta imagen).
    setFotoPosicion(50, 50);
}

userPhoto.addEventListener("change", updatePhotoPreview);

// Sin el <input type=file> cubriendo todo el circulo (eso ahora bloqueaba
// poder arrastrar la foto para reencuadrarla, ver pointerdown mas arriba),
// el dropzone necesita su propio listener para abrir el selector de
// archivos -- pero solo mientras se ve el placeholder ("Arrastra o haz
// clic"), no cuando ya hay una foto (ahi el clic es para arrastrarla).
userPhotoDropzone.addEventListener("click", () => {
    if (!userPhotoPlaceholder.classList.contains("hidden")) userPhoto.click();
});

["dragenter", "dragover"].forEach((eventName) => {
    userPhotoDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        userPhotoDropzone.classList.add("dropzone-active");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    userPhotoDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        userPhotoDropzone.classList.remove("dropzone-active");
    });
});

userPhotoDropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    userPhoto.files = event.dataTransfer.files;
    userPhoto.dispatchEvent(new Event("change"));
});

async function saveUser(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("nombre", userName.value);
    formData.set("email", buildEmail(userEmail.value));
    formData.set("celular", userCelular.value);
    formData.set("password", userPassword.value);
    formData.set("role_id", userRole.value);
    formData.set("activo", String(userActive.checked));
    if (userPhoto.files?.[0]) {
        formData.set("foto", userPhoto.files[0]);
    }
    if (!userPhotoPreview.classList.contains("hidden")) {
        formData.set("foto_posicion", userFotoPosicion.value);
    }

    try {
        window.VehiAmb.ui.show(loader);

        if (userId.value) {
            await window.VehiAmb.api.updateUsuario(userId.value, formData);
            window.VehiAmb.ui.showMessage(mensaje, "Usuario actualizado correctamente");
        } else {
            await window.VehiAmb.api.createUsuario(formData);
            window.VehiAmb.ui.showMessage(mensaje, "Usuario creado correctamente");
        }

        resetForm();
        await loadUsers();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible guardar el usuario", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

async function loadUsers() {
    usersState = await window.VehiAmb.api.getUsuarios();
    renderUsersKpis();
    renderUsersRoleChips();
    applyUserFilters();
}

async function refreshRolesAndPermissions() {
    rolesState = await window.VehiAmb.api.getRoles();
    fillRoles();
    renderRolePermissions();
}

async function saveRolePermissions(event) {
    const form = event.target.closest(".role-permission-form");
    if (!form) return;

    event.preventDefault();

    const permissionIds = [...form.querySelectorAll('input[name="permission"]:checked')]
        .map((input) => input.value);

    try {
        window.VehiAmb.ui.show(loader);
        await window.VehiAmb.api.updateRolePermissions(form.dataset.roleId, permissionIds);
        await refreshRolesAndPermissions();
        await window.VehiAmb.auth.fetchCurrentUser();
        window.VehiAmb.ui.showMessage(mensaje, "Permisos actualizados correctamente");
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible actualizar los permisos", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

async function initAdminUsers() {
    try {
        window.VehiAmb.ui.show(loader);

        const [roles, permissions, users] = await Promise.all([
            window.VehiAmb.api.getRoles(),
            window.VehiAmb.api.getPermisos(),
            window.VehiAmb.api.getUsuarios()
        ]);

        rolesState = roles;
        permissionsState = permissions;
        usersState = users;

        resetForm();
        renderUsersKpis();
        renderUsersRoleChips();
        applyUserFilters();
        renderRolePermissions();

        // Llegada desde una notificacion ("Ver usuario") -- abre de una vez
        // el formulario de edicion de ese usuario puntual.
        const usuarioIdParam = new URLSearchParams(window.location.search).get("usuario_id");
        if (usuarioIdParam) editUser(usuarioIdParam);
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible cargar la administración", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

userForm.addEventListener("submit", saveUser);
cancelEditButton.addEventListener("click", resetForm);
userSearchInput.addEventListener("input", applyUserFilters);

usersRoleChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-users-rol]");
    if (!chip) return;

    usersRoleActiva = chip.dataset.usersRol;
    usersRoleChips.querySelectorAll(".notif-filtro-chip").forEach((c) => {
        c.classList.toggle("active", c.dataset.usersRol === usersRoleActiva);
    });
    applyUserFilters();
});

usersList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "edit") {
        editUser(button.dataset.id);
        return;
    }

    if (button.dataset.action === "toggle") {
        toggleUser(button.dataset.id, button.dataset.active === "true");
    }
});

rolesPermissions.addEventListener("submit", saveRolePermissions);

document.addEventListener("DOMContentLoaded", initAdminUsers);
