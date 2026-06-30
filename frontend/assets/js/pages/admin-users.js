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
const rolesPermissions = document.getElementById("rolesPermissions");

let usersState = [];
let rolesState = [];
let permissionsState = [];

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

function roleNameById(roleId) {
    return rolesState.find((role) => String(role.id) === String(roleId))?.nombre || "Sin rol";
}

function renderUsers() {
    if (!usersState.length) {
        usersList.innerHTML = '<p class="dash-empty">Aun no hay usuarios registrados</p>';
        return;
    }

    usersList.innerHTML = usersState.map((user) => `
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
    userRole.value = user.role_id || "";
    userActive.checked = Boolean(user.activo);
    userFormMode.textContent = "Editar usuario";
    userName.focus();
}

async function toggleUser(id, active) {
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
        email: userEmail.value,
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
    renderUsers();
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
        renderUsers();
        renderRolePermissions();
    } catch (error) {
        console.error(error);
        window.VehiAmb.ui.showMessage(mensaje, error.message || "No fue posible cargar la administracion", "error");
    } finally {
        window.VehiAmb.ui.hide(loader);
    }
}

userForm.addEventListener("submit", saveUser);
cancelEditButton.addEventListener("click", resetForm);

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
