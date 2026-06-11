async function cargarSidebar() {
    const res = await fetch('components/sidebar.html');
    const html = await res.text();

    const aside = document.getElementById('sidebar');
    if (!aside) return;

    aside.innerHTML = html;

    // Marca como "active" el botón de la página actual
    const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
    aside.querySelectorAll('button[data-page]').forEach(btn => {
        if (btn.dataset.page === paginaActual) {
            btn.classList.add('active');
        }
        // Navega al hacer clic (solo si no está disabled)
        btn.addEventListener('click', () => {
            window.location.href = btn.dataset.page;
        });
    });
}

cargarSidebar();
