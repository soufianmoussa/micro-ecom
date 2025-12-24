const apiBase = 'http://localhost:4000'; // products
const cartBase = 'http://localhost:4001';
const orderBase = 'http://localhost:4002';
const authBase = 'http://localhost:4003';

// State
let currentUser = null; // { id, username, token }
let authMode = 'login'; // 'login' or 'register'

// DOM Elements
const productsGrid = document.getElementById('products-grid');
const cartPanel = document.getElementById('cart-panel');
const cartItemsContainer = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const authModal = document.getElementById('auth-modal');
const modalTitle = document.getElementById('modal-title');
const authForm = document.getElementById('auth-form');
const userGreeting = document.getElementById('user-greeting');

// Init
function init() {
  loadCategories();
  loadProducts();
  // Check local storage for session
  const stored = localStorage.getItem('user');
  if (stored) {
    currentUser = JSON.parse(stored);
    updateAuthUI();
    loadCart();
  }
}

// --- Auth Functions ---
function showAuth(mode) {
  authMode = mode;
  modalTitle.textContent = mode === 'login' ? 'Login' : 'Create Account';

  // Toggle extra fields
  const extras = document.querySelectorAll('.extra-fields');
  extras.forEach(el => el.style.display = mode === 'register' ? 'block' : 'none');

  authModal.classList.add('open');
}

function hideAuth() {
  authModal.classList.remove('open');
  authForm.reset();
}

function updateAuthUI() {
  if (currentUser) {
    document.getElementById('btn-login').style.display = 'none';
    document.getElementById('btn-register').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'inline-block';
    document.getElementById('btn-profile').style.display = 'inline-block';
    userGreeting.textContent = `Hi, ${currentUser.username}`;
    userGreeting.style.display = 'inline-block';
  } else {
    document.getElementById('btn-login').style.display = 'inline-block';
    document.getElementById('btn-register').style.display = 'inline-block';
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('btn-profile').style.display = 'none';
    userGreeting.style.display = 'none';
    cartCount.textContent = '0';
    cartItemsContainer.innerHTML = '';
  }
}

authForm.onsubmit = async (e) => {
  e.preventDefault();
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  const addr = document.getElementById('reg-address').value;
  const phone = document.getElementById('reg-phone').value;

  const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
  const body = { username: u, password: p };
  if (authMode === 'register') {
    body.address = addr;
    body.phone = phone;
  }

  try {
    const res = await fetch(`${authBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Auth failed');

    if (authMode === 'register') {
      alert('Registration successful! Please login.');
      showAuth('login');
    } else {
      currentUser = data.user;
      currentUser.token = data.token;
      localStorage.setItem('user', JSON.stringify(currentUser));
      hideAuth();
      updateAuthUI();
      loadCart();
    }
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('btn-logout').onclick = () => {
  currentUser = null;
  localStorage.removeItem('user');
  updateAuthUI();
};

// --- Product & Cart ---
async function loadCategories() {
  try {
    const res = await fetch(`${apiBase}/categories`);
    const cats = await res.json();

    // 1. Filter Buttons
    const filterContainer = document.getElementById('category-filter');
    // Clear existing buttons except first Child "All" if we wanted, but appending is safer for now.

    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'nav-btn category-btn';
      btn.textContent = c.name;
      btn.onclick = () => filterCategory(c.name, btn);
      filterContainer.appendChild(btn);
    });

    // 2. Visual Cards
    const cardContainer = document.getElementById('category-cards');
    if (cardContainer) {
      const catImages = {
        'Electronics': 'https://placehold.co/300x150/10b981/ffffff?text=Electronics',
        'Clothing': 'https://placehold.co/300x150/f59e0b/ffffff?text=Clothing',
        'Home': 'https://placehold.co/300x150/8b5cf6/ffffff?text=Home'
      };
      cardContainer.innerHTML = cats.map(c => `
                <div class="category-card" onclick="forceFilter('${c.name}')" style="cursor:pointer; position:relative; border-radius:8px; overflow:hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <img src="${catImages[c.name] || 'https://placehold.co/300x150?text=' + c.name}" style="width:100%; height:120px; object-fit:cover; display:block;" />
                    <div style="background:#1e293b; color:white; padding:0.8rem; text-align:center; font-weight:600;">
                        ${c.name}
                    </div>
                </div>
            `).join('');
    }
  } catch (err) { console.error('Failed to load categories'); }
}

function forceFilter(catName) {
  activeCategory = catName;
  document.querySelectorAll('.category-btn').forEach(b => {
    b.classList.remove('active');
    if (b.textContent === catName) b.classList.add('active');
  });
  loadProducts();
  document.getElementById('products-grid').scrollIntoView({ behavior: 'smooth' });
}

let activeCategory = '';

function filterCategory(catName, btn) {
  activeCategory = catName;
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector('.category-btn[data-id=""]').classList.add('active');
  loadProducts();
}

async function loadProducts() {
  try {
    let url = `${apiBase}/products?limit=12`; // Fetch more for homepage
    if (typeof activeCategory !== 'undefined' && activeCategory) {
      url += `&category=${encodeURIComponent(activeCategory)}`;
    }
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    // Handle both array (legacy) and object (paginated) responses
    const products = Array.isArray(data) ? data : (data.products || []);

    if (products.length === 0) {
      productsGrid.innerHTML = '<p>No products found.</p>';
      return;
    }

    productsGrid.innerHTML = products.map(p => `
            <div class="product-card">
                <div class="product-img-wrapper">
                    <img src="${p.image_url || 'https://placehold.co/400x300?text=No+Image'}" alt="${p.name}" loading="lazy" />
                </div>
                <div class="product-content">
                    <div class="product-name">${p.name}</div>
                    <div style="font-size: 0.8rem; color:#888; margin-bottom:0.5rem">${p.category_name || ''}</div>
                    <div class="product-desc">${p.description}</div>
                    <div class="product-footer">
                        <div class="product-price">$${p.price}</div>
                        <button class="btn-add" onclick="addToCart('${p.id}')">Add +</button>
                    </div>
                </div>
            </div>
        `).join('');
  } catch (err) {
    productsGrid.innerHTML = `<div style="color:red; text-align:center;">
      <p>Failed to load products.</p>
      <p style="font-family:monospace; font-size:0.9rem; margin-top:0.5rem;">${err.message}</p>
      <p style="font-size:0.8rem; color:#666;">Ensure Docker running & hard refresh.</p>
    </div>`;
    console.error('Products Load Error:', err);
  }
}

async function addToCart(productId) {
  if (!currentUser) {
    showAuth('login');
    return;
  }
  try {
    await fetch(`${cartBase}/cart/${currentUser.id}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, qty: 1 })
    });
    loadCart();
    // create a small toast or visual feedback
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Added!';
    btn.style.backgroundColor = '#10b981';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.backgroundColor = '';
    }, 1000);
  } catch (err) {
    console.error(err);
  }
}

async function loadCart() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${cartBase}/cart/${currentUser.id}`);
    const cart = await res.json();
    const itemCount = cart.items ? cart.items.reduce((acc, i) => acc + i.qty, 0) : 0;
    cartCount.textContent = itemCount;

    if (!cart.items || cart.items.length === 0) {
      cartItemsContainer.innerHTML = '<p style="text-align:center; color: #aaa;">Cart is empty</p>';
      return;
    }

    // Fetch details for all items
    const detailedItems = await Promise.all(cart.items.map(async (item) => {
      try {
        const pRes = await fetch(`${apiBase}/products/${item.productId}`);
        const product = await pRes.json();
        return { ...item, product };
      } catch (e) {
        return { ...item, product: { name: 'Unknown Product', price: 0 } };
      }
    }));

    cartItemsContainer.innerHTML = detailedItems.map(i => `
        <div class="cart-item">
            <img src="${i.product.image_url || 'https://placehold.co/100'}" class="cart-thumb" alt="${i.product.name}" />
            <div class="cart-item-details">
                <div class="cart-item-title">${i.product.name}</div>
                <div class="cart-item-price">
                    $${i.product.price} x ${i.qty}
                </div>
            </div>
            <div style="font-weight:600;">$${(i.product.price * i.qty).toFixed(2)}</div>
        </div>
    `).join('');

    // Add Total
    const total = detailedItems.reduce((acc, i) => acc + (i.product.price * i.qty), 0);
    const totalEl = document.createElement('div');
    totalEl.style.marginTop = '1rem';
    totalEl.style.fontWeight = 'bold';
    totalEl.style.textAlign = 'right';
    totalEl.innerHTML = `Total: $${total.toFixed(2)}`;
    cartItemsContainer.appendChild(totalEl);

  } catch (err) { console.error(err); }
}

document.getElementById('btn-checkout').onclick = async () => {
  if (!currentUser) return;
  try {
    const res = await fetch(`${orderBase}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
    const data = await res.json();
    if (res.ok) {
      // alert('Order placed successfully! ID: ' + data.id); // Replaced by UI
      showOrderSuccess(data.id);
      loadCart();
      cartPanel.classList.remove('open');
    } else {
      alert('Error: ' + JSON.stringify(data));
    }
  } catch (err) { alert('Order failed'); }
};

function showOrderSuccess(orderId) {
  document.getElementById('main-content').style.display = 'none';
  document.querySelector('.carousel-container').style.display = 'none';

  const successDiv = document.getElementById('order-success');
  document.getElementById('success-order-id').innerText = '#' + orderId;
  successDiv.style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.resetShop = function () {
  document.getElementById('order-success').style.display = 'none';
  document.querySelector('.carousel-container').style.display = 'block';
  document.getElementById('main-content').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Profile Functions ---
const profileModal = document.getElementById('profile-modal');
const profileForm = document.getElementById('profile-form');

async function openProfile() {
  if (!currentUser) return;
  profileModal.classList.add('open');
  // Fetch latest data
  try {
    const res = await fetch(`${authBase}/profile/${currentUser.id}`);
    const user = await res.json();
    document.getElementById('prof-username').value = user.username;
    document.getElementById('prof-address').value = user.address || '';
    document.getElementById('prof-phone').value = user.phone || '';
  } catch (err) { console.error(err); }
}

function closeProfile() {
  profileModal.classList.remove('open');
}

profileForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const address = document.getElementById('prof-address').value;
  const phone = document.getElementById('prof-phone').value;

  try {
    const res = await fetch(`${authBase}/profile/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, phone })
    });
    if (res.ok) {
      alert('Profile updated!');
      closeProfile();
    } else {
      alert('Failed to update profile');
    }
  } catch (err) { console.error(err); }
};

// --- Event Listeners ---
document.getElementById('btn-login').onclick = () => showAuth('login');
document.getElementById('btn-register').onclick = () => showAuth('register');
document.getElementById('btn-close-modal').onclick = hideAuth;
document.getElementById('btn-cart').onclick = () => cartPanel.classList.add('open');
document.getElementById('btn-close-cart').onclick = () => cartPanel.classList.remove('open');
document.getElementById('btn-profile').onclick = openProfile;
document.getElementById('btn-close-profile').onclick = closeProfile;

// --- Carousel ---
let currentSlide = 0;
function initCarousel() {
  const slides = document.querySelectorAll('.carousel-slide');
  const dotsContainer = document.getElementById('carousel-dots');

  // Create dots
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = `dot ${i === 0 ? 'active' : ''}`;
    dot.onclick = () => goToSlide(i);
    dotsContainer.appendChild(dot);
  });

  setInterval(() => {
    nextSlide();
  }, 5000);
}

function goToSlide(n) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');

  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');

  currentSlide = (n + slides.length) % slides.length;

  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}

function nextSlide() {
  goToSlide(currentSlide + 1);
}

// Start
init();
initCarousel();
