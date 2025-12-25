
const productBase = '/api/products';
const userBase = '/api/auth';
const cartBase = '/api/cart';
const orderBase = '/api/orders';

let currentUser = null;
let currentPage = 1;
let currentCategory = '';
let totalPages = 1;

async function init() {
    await checkAuth(); // Re-use logic or copy simplified
    loadCategories();
    loadProducts();
    loadCart(); // Load cart count
    setupAuthUI();
}

async function checkAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
        currentUser = JSON.parse(userStr);
        updateAuthUI();
    }
}

function updateAuthUI() {
    const isLc = !!currentUser;
    document.getElementById('btn-login').style.display = isLc ? 'none' : 'flex';
    document.getElementById('btn-register').style.display = isLc ? 'none' : 'flex';
    document.getElementById('btn-logout').style.display = isLc ? 'flex' : 'none';
    document.getElementById('btn-profile').style.display = isLc ? 'flex' : 'none';

    if (isLc) {
        const greet = document.getElementById('user-greeting');
        greet.style.display = 'inline-block';
        greet.innerText = `Hi, ${currentUser.name}`;
    }
}

async function loadCategories() {
    try {
        const res = await fetch(`${productBase}/categories`);
        const cats = await res.json();
        const container = document.getElementById('sidebar-categories');

        // All Button
        container.innerHTML = `<button class="category-btn ${currentCategory === '' ? 'active' : ''}" onclick="filterCategory('')" style="width:100%; text-align:left; margin-bottom:0.5rem; border-radius:8px;">All Products</button>`;

        cats.forEach(c => {
            container.innerHTML += `
        <button class="category-btn ${currentCategory === c.name ? 'active' : ''}" 
          onclick="filterCategory('${c.name}')" 
          style="width:100%; text-align:left; margin-bottom:0.5rem; border-radius:8px;">
          ${c.name}
        </button>
      `;
        });
    } catch (e) { console.error(e); }
}

window.filterCategory = (cat) => {
    currentCategory = cat;
    currentPage = 1;
    loadProducts();

    // Update Active State Visuals (Simple re-render)
    loadCategories();
};

// State Extensions
let searchVal = '';
let minPrice = '';
let maxPrice = '';
let currentSort = '';
let searchTimeout;

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchVal = document.getElementById('filter-search').value;
        currentPage = 1;
        loadProducts();
    }, 500);
}

function applyFilters() {
    minPrice = document.getElementById('filter-min').value;
    maxPrice = document.getElementById('filter-max').value;
    currentSort = document.getElementById('sort-select').value;
    currentPage = 1;
    loadProducts();
}

async function loadProducts() {
    const container = document.getElementById('products-grid');
    container.innerHTML = '<p>Loading...</p>';
    try {
        let url = `${productBase}/products?page=${currentPage}&limit=6`;
        if (currentCategory) url += `&category=${encodeURIComponent(currentCategory)}`;
        if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;
        if (minPrice) url += `&minPrice=${minPrice}`;
        if (maxPrice) url += `&maxPrice=${maxPrice}`;
        if (currentSort) url += `&sort=${currentSort}`;

        const res = await fetch(url);
        const data = await res.json(); // { products: [], meta: {} }

        const products = data.products || [];
        const meta = data.meta || { page: 1, totalPages: 1, total: 0 };

        totalPages = meta.totalPages;
        currentPage = meta.page;

        document.getElementById('results-count').innerText = `(${meta.total})`;

        if (products.length === 0) {
            container.innerHTML = '<p>No products match your criteria.</p>';
            renderPagination();
            return;
        }

        container.innerHTML = products.map(p => `
      <div class="product-card">
        <div class="product-img-wrapper">
          <img src="${p.image_url || 'https://placehold.co/300'}" alt="${p.name}">
        </div>
        <div class="product-content">
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.description}</div>
          <div class="product-footer">
            <div class="product-price">$${p.price}</div>
            <button class="btn-add" onclick="addToCart('${p.id}')">+</button>
          </div>
        </div>
      </div>
    `).join('');

        renderPagination();

        document.getElementById('page-title').innerText = currentCategory ? `${currentCategory}` : 'All Products';

    } catch (err) {
        container.innerHTML = '<p>Error loading products.</p>';
    }
}

function renderPagination() {
    const container = document.getElementById('pagination');
    let html = '';

    // Prev
    html += `<button class="btn-primary" style="padding:0.5rem 1rem;" ${currentPage === 1 ? 'disabled style="opacity:0.5"' : ''} onclick="changePage(${currentPage - 1})">Prev</button>`;

    // Numbers
    for (let i = 1; i <= totalPages; i++) {
        const activeStyle = i === currentPage ? 'background:var(--secondary-color);' : 'background:transparent; color:var(--text-dark); border:1px solid #ddd;';
        html += `<button class="btn-primary" style="padding:0.5rem 1rem; ${activeStyle}" onclick="changePage(${i})">${i}</button>`;
    }

    // Next
    html += `<button class="btn-primary" style="padding:0.5rem 1rem;" ${currentPage === totalPages ? 'disabled style="opacity:0.5"' : ''} onclick="changePage(${currentPage + 1})">Next</button>`;

    container.innerHTML = html;
}

window.changePage = (p) => {
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Cart Logic (Simplified Copy) ---
async function addToCart(pid) {
    if (!currentUser) return alert('Please login first');
    await fetch(`${cartBase}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, productId: pid, qty: 1 })
    });
    loadCart();
}

async function loadCart() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${cartBase}/cart/${currentUser.id}`);
        const items = await res.json();
        const badge = document.getElementById('cart-count');
        const count = items.reduce((a, c) => a + c.qty, 0);
        if (badge) badge.innerText = count;
    } catch (e) { }
}

function setupAuthUI() {
    // Basic Modal Toggles matching index.html IDs
    const modal = document.getElementById('auth-modal');
    const close = document.getElementById('close-modal');
    const loginBtn = document.getElementById('btn-login');
    const registerBtn = document.getElementById('btn-register');

    if (loginBtn) loginBtn.onclick = () => { modal.classList.add('open'); };
    if (registerBtn) registerBtn.onclick = () => { modal.classList.add('open'); }; // Simplified
    if (close) close.onclick = () => { modal.classList.remove('open'); };

    // Use common Auth logic if separated, but for now this is fine for display
}

// Cart Drawer Toggles
const cartBtn = document.getElementById('btn-cart');
const cartPanel = document.getElementById('cart-panel');
const closeCart = document.getElementById('close-cart');
if (cartBtn) cartBtn.onclick = async () => {
    cartPanel.classList.add('open');
    // Ideally render full cart here like app.js
};
if (closeCart) closeCart.onclick = () => cartPanel.classList.remove('open');


init();
