const loader = document.getElementById("loader");
const mensaje = document.getElementById("mensaje");
const userForm = document.getElementById("userForm");
const userId = document.getElementById("userId");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userPassword = document.getElementById("userPassword");
const userRole = document.getElementById("userRole");
const userActive = document.getElementById("userActive");
const userFormMode = document.getElementById("userFormMode");
const cancelEditButton = document.getElementById("cancelEditButton");
const usersList = document.getElementById("usersList");
const usersKpisGrid = document.getElementById("usersKpisGrid");
const userSearchInput = document.getElementById("userSearchInput");
const rolesPermissions = document.getElementById("rolesPermissions");
const toggleUserPasswordButton = document.getElementById("toggleUserPasswordButton");
const userPasswordIconEye = toggleUserPasswordButton.querySelector(".icon-eye");
const userPasswordIconEyeOff = toggleUserPasswordButton.querySelector(".icon-eye-off");

let usersState = [];
let rolesState = [];
let permissionsState = [];

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

function resetForm() {
    userForm.reset();
    userId.value = "";
    userActive.checked = true;
    userPassword.required = true;
    userFormMode.textContent = "Nuevo usuario";
    hideUserPassword();
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

function matchesUserSearch(user) {
    const termino = userSearchInput.value.trim().toLowerCase();
    if (!termino) return true;

    return String(user.nombre || "").toLowerCase().includes(termino)
        || String(user.email || "").toLowerCase().includes(termino);
}

function applyUserFilters() {
    renderUsers(usersState.filter(matchesUserSearch));
}

function renderUsers(rows) {
    if (!rows.length) {
        usersList.innerHTML = usersState.length
            ? '<p class="dash-empty">Ningún usuario coincide con la búsqueda</p>'
            : '<p class="dash-empty">Aún no hay usuarios registrados</p>';
        return;
    }

    usersList.innerHTML = rows.map((user) => `
        <article class="admin-user-item">
            <div>
                <div class="record-top">
                    <div>
                        <span class="record-title">${escapeHtml(user.nombre)}</span>
                        <span class="record-sub">${escapeHtml(user.email)}</span>
                    </div>
                    <span class="badge ${user.activo ? "badge-verde" : "badge-rojo"}">
                        ${user.activo ? "Activo" : "Inactivo"}
                    </span>
                </div>
                <div class="record-meta">
                    <span class="pill">${escapeHtml(user.rol || roleNameById(user.role_id))}</span>
                </div>
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
    userPassword.value = "";
    userPassword.required = false;
    hideUserPassword();
    ensureRoleOption(user.role_id);
    userRole.value = user.role_id || "";
    userActive.checked = Boolean(user.activo);
    userFormMode.textContent = "Editar usuario";
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

async function saveUser(event) {
    event.preventDefault();

    const payload = {
        nombre: userName.value,
        email: buildEmail(userEmail.value),
        password: userPassword.value,
        role_id: userRole.value,
        activo: userActive.checked
    };

    try {
        window.VehiAmb.ui.show(loader);

        if (userId.value) {
            await window.VehiAmb.api.updateUsuario(userId.value, payload);
            window.VehiAmb.ui.showMessage(mensaje, "Usuario actualizado correctamente");
        } else {
            await window.VehiAmb.api.createUsuario(payload);
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

        fillRoles();
        renderUsersKpis();
        applyUserFilters();
        renderRolePermissions();
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
