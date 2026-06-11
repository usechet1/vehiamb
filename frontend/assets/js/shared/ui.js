window.VehiAmb = window.VehiAmb || {};

window.VehiAmb.ui = {
    show(element) {
        element?.classList.remove("hidden");
    },

    hide(element) {
        element?.classList.add("hidden");
    },

    showMessage(element, text, type = "success") {
        if (!element) return;

        element.textContent = text;
        element.classList.toggle("error", type === "error");
        element.classList.remove("hidden");

        window.setTimeout(() => {
            element.classList.add("hidden");
            element.classList.remove("error");
        }, 3000);
    }
};
