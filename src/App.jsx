import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ikafe-loyality-backend.onrender.com/api';

const LEVEL_DETAILS = {
  1: { label: 'Level 1', cashbackRate: 1, range: 'Visits 1-5' },
  2: { label: 'Level 2', cashbackRate: 2, range: 'Visits 6-15' },
  3: { label: 'Level 3', cashbackRate: 3, range: 'Visits 16-25' },
  4: { label: 'Level 4', cashbackRate: 4, range: 'Visits 26-35' },
  5: { label: 'Level 5', cashbackRate: 5, range: 'Visits 36+' }
};

function formatRwf(value) {
  return `${Number(value || 0).toLocaleString('en-US')} RWF`;
}

function App() {
  const [appMode, setAppMode] = useState('landing');
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [qrCode, setQrCode] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [staffLookupInput, setStaffLookupInput] = useState('');

  const [joinForm, setJoinForm] = useState({ name: '', phone: '', email: '' });
  const [purchaseForm, setPurchaseForm] = useState({ customerId: '', amount: '' });
  const [userForm, setUserForm] = useState({ role: 'staff', username: '', password: '', email: '' });
  const [editUserForm, setEditUserForm] = useState({ id: '', role: '', username: '', password: '', email: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loginMode, setLoginMode] = useState(null);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [staffLogin, setStaffLogin] = useState({ username: '', password: '' });
  const [adminLogin, setAdminLogin] = useState({ username: '', password: '' });
  const [authToken, setAuthToken] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setCustomers([]);
    }
  };

  const loadUsers = async () => {
    if (!authToken || authUser?.role !== 'admin') {
      setUsers([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to load users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setUsers([]);
    }
  };

  const loadTransactions = async (customerId) => {
    if (!customerId) {
      setTransactions([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/loyalty/${customerId}/transactions`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setTransactions([]);
    }
  };

  useEffect(() => {
    if (authToken) {
      loadCustomers();
      loadUsers();
    }
  }, [authToken]);

  useEffect(() => {
    const saved = localStorage.getItem('ikafeAuth');
    if (saved) {
      try {
        const { token, user } = JSON.parse(saved);
        if (token && user) {
          setAuthToken(token);
          setAuthUser(user);
        }
      } catch (error) {
        console.error('Failed to restore auth', error);
      }
    }
  }, []);

  const stats = useMemo(() => {
    const totalWalletBalance = customers.reduce((sum, item) => sum + Number(item.walletBalance || 0), 0);
    const totalSpent = customers.reduce((sum, item) => sum + Number(item.totalSpent || 0), 0);
    const totalVisits = customers.reduce((sum, item) => sum + Number(item.visits || 0), 0);
    return { totalWalletBalance, totalSpent, totalVisits };
  }, [customers]);

  const topCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => Number(b.walletBalance || 0) - Number(a.walletBalance || 0))
      .slice(0, 5);
  }, [customers]);

  const showMessage = (type, text) => setMessage({ type, text });

  const syncCustomerState = async (customerData, generatedQrCode = '') => {
    setCustomer(customerData);
    setQrCode(generatedQrCode);
    setPurchaseForm((prev) => ({ ...prev, customerId: customerData.customerId }));
    await loadTransactions(customerData.customerId);
  };

  const handleReturnHome = () => {
    setAppMode('landing');
    setCustomer(null);
    setQrCode('');
    setTransactions([]);
    setCustomerIdInput('');
    setStaffLookupInput('');
    setPurchaseForm({ customerId: '', amount: '' });
    setJoinForm({ name: '', phone: '', email: '' });
    setAuthToken('');
    setAuthUser(null);
    localStorage.removeItem('ikafeAuth');
    setMessage({ type: '', text: '' });
  };

  const goToStaff = () => {
    setLoginMode('staff');
    setShowLoginPanel(true);
    setMessage({ type: '', text: '' });
  };

  const goToAdmin = () => {
    setLoginMode('admin');
    setShowLoginPanel(true);
    setMessage({ type: '', text: '' });
  };

  const openLoginPanel = () => {
    setShowLoginPanel(true);
    setLoginMode(null);
    setMessage({ type: '', text: '' });
  };

  const handleStaffLogin = async (event) => {
    event.preventDefault();
    if (!staffLogin.username || !staffLogin.password) {
      return showMessage('error', 'Enter staff username and password');
    }

    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: staffLogin.username, password: staffLogin.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      if (data.role !== 'staff' && data.role !== 'admin') {
        throw new Error('Access denied for this role');
      }
      setAuthToken(data.token);
      setAuthUser({ username: data.username, role: data.role, email: data.email });
      localStorage.setItem('ikafeAuth', JSON.stringify({ token: data.token, user: { username: data.username, role: data.role, email: data.email } }));
      setAppMode('staff');
      setLoginMode(null);
      setMessage({ type: 'success', text: 'Staff login successful' });
      loadCustomers();
      if (data.role === 'admin') loadUsers();
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    if (!adminLogin.username || !adminLogin.password) {
      return showMessage('error', 'Enter admin username and password');
    }

    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminLogin.username, password: adminLogin.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      if (data.role !== 'admin') {
        throw new Error('Admin access required');
      }
      setAuthToken(data.token);
      setAuthUser({ username: data.username, role: data.role, email: data.email });
      localStorage.setItem('ikafeAuth', JSON.stringify({ token: data.token, user: { username: data.username, role: data.role, email: data.email } }));
      setAppMode('admin');
      setLoginMode(null);
      setMessage({ type: 'success', text: 'Admin login successful' });
      loadCustomers();
      loadUsers();
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/customers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Membership join failed');
      await syncCustomerState(data.customer, data.qrCode || '');
      setJoinForm({ name: '', phone: '', email: '' });
      showMessage('success', `Welcome ${data.customer.name}! Your loyalty card is ready.`);
      loadCustomers();
      setAppMode('customer');
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleLookup = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/customers/${customerIdInput}`);
      const data = await res.json();
      if (!res.ok || !data) throw new Error('Customer not found');
      await syncCustomerState(data);
      showMessage('success', `Loaded ${data.name}`);
      setAppMode('customer');
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleStaffLookup = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/customers/${staffLookupInput}`);
      const data = await res.json();
      if (!res.ok || !data) throw new Error('Customer not found');
      await syncCustomerState(data);
      setPurchaseForm((prev) => ({ ...prev, customerId: data.customerId }));
      showMessage('success', 'Customer loaded for checkout');
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handlePurchase = async (event) => {
    event.preventDefault();
    if (!authToken) {
      return showMessage('error', 'Staff or admin login required');
    }

    try {
      const res = await fetch(`${API_BASE}/loyalty/process-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ customerId: purchaseForm.customerId, amount: Number(purchaseForm.amount) })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Response is not JSON:', text);
        throw new Error('Server returned invalid response. Please try again.');
      }
      
      if (!res.ok) throw new Error(data.message || 'Unable to process purchase');
      setPurchaseForm((prev) => ({ ...prev, amount: '' }));
      showMessage('success', `Purchase processed. Cashback earned: ${formatRwf(data.cashbackEarned)}.`);
      loadCustomers();
      if (purchaseForm.customerId) {
        const customerRes = await fetch(`${API_BASE}/customers/${purchaseForm.customerId}`);
        const customerData = await customerRes.json();
        await syncCustomerState(customerData);
      }
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (!authToken) {
      return showMessage('error', 'Admin login required to add users');
    }

    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          role: userForm.role,
          username: userForm.username,
          password: userForm.password,
          email: userForm.email
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'User could not be created');
      setUserForm({ role: 'staff', username: '', password: '', email: '' });
      showMessage('success', `${data.username || 'User'} created successfully`);
      loadUsers();
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleEditUser = (user) => {
    setEditUserForm({
      id: user._id,
      role: user.role,
      username: user.username,
      password: '',
      email: user.email || ''
    });
    setEditingUser(user);
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    if (!authToken) {
      return showMessage('error', 'Admin login required to update users');
    }

    try {
      const res = await fetch(`${API_BASE}/users/${editUserForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          role: editUserForm.role,
          username: editUserForm.username,
          password: editUserForm.password || undefined,
          email: editUserForm.email
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'User could not be updated');
      setEditUserForm({ id: '', role: '', username: '', password: '', email: '' });
      setEditingUser(null);
      showMessage('success', `${data.username || 'User'} updated successfully`);
      loadUsers();
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!authToken) {
      return showMessage('error', 'Admin login required to delete users');
    }

    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'User could not be deleted');
      showMessage('success', 'User deleted successfully');
      loadUsers();
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h1>Ikafé Loyalty</h1>
            <p>Visit-based cashback and wallet redemption.</p>
          </div>
          <button className="mobile-menu-toggle" onClick={() => setSidebarOpen((open) => !open)}>
            {sidebarOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {appMode !== 'landing' ? (
            <button className="nav-btn" onClick={handleReturnHome}>
              Back to home
            </button>
          ) : (
            <div className="role-label">Choose your role</div>
          )}
        </nav>

        <div className="card compact">
          <h3>Live stats</h3>
          <p>{customers.length} customers</p>
          <p>{formatRwf(stats.totalWalletBalance)} wallet balance</p>
          <p>{formatRwf(stats.totalSpent)} total spend</p>
        </div>
      </aside>

      <main className="main-content">
        {message.text ? (
          <div className={`banner ${message.type}`}>{message.text}</div>
        ) : null}

        {appMode === 'landing' && (
          <section className="view-grid home-hero">
            <div className="card hero-card wide">
              <div className="hero-topbar">
                <div className="hero-topbar-left">
                  <p className="eyebrow">☕ Ikafé Loyalty Program</p>
                </div>
                <div className="hero-topbar-right">
                  <button className="cta-secondary" onClick={() => document.getElementById('join-form')?.scrollIntoView({ behavior: 'smooth' })}>Get Started</button>
                  <button className="hero-login-link ghost-button" onClick={openLoginPanel}>Team Access</button>
                </div>
              </div>

              <div className="hero-card-top">
                <div className="hero-copy">
                  <p className="eyebrow">Rewards That Grow With You</p>
                  <h2>Earn Cashback on Every Visit • Unlock Exclusive Perks • Redeem Your Wallet</h2>
                  <p>Join our loyalty program and earn up to 5% cashback on every purchase. Watch your rewards grow as you climb through 5 exclusive levels, from your first visit to VIP status.</p>
                  <div className="hero-actions">
                    <button className="cta-primary" onClick={() => document.getElementById('join-form')?.scrollIntoView({ behavior: 'smooth' })}>Start Earning Today</button>
                    <button className="cta-secondary" onClick={openLoginPanel}>Staff Dashboard</button>
                  </div>
                </div>

                <div className="hero-login-box">
                  <div className="hero-login-header">
                    <p className="eyebrow">🔐 Team Portal</p>
                    <p className="small">Secure access for staff and administrators</p>
                  </div>
                  <div className="hero-login-buttons">
                    <button className="role-button" onClick={goToStaff}>Staff Login</button>
                    <button className="role-button ghost-button" onClick={goToAdmin}>Admin Login</button>
                  </div>
                  {loginMode === 'staff' ? (
                    <form onSubmit={handleStaffLogin} className="stack login-form">
                      <input placeholder="Staff username" value={staffLogin.username} onChange={(e) => setStaffLogin({ ...staffLogin, username: e.target.value })} required />
                      <input type="password" placeholder="Password" value={staffLogin.password} onChange={(e) => setStaffLogin({ ...staffLogin, password: e.target.value })} required />
                      <button type="submit">Access Staff Dashboard</button>
                    </form>
                  ) : null}
                  {loginMode === 'admin' ? (
                    <form onSubmit={handleAdminLogin} className="stack login-form">
                      <input placeholder="Admin username" value={adminLogin.username} onChange={(e) => setAdminLogin({ ...adminLogin, username: e.target.value })} required />
                      <input type="password" placeholder="Password" value={adminLogin.password} onChange={(e) => setAdminLogin({ ...adminLogin, password: e.target.value })} required />
                      <button type="submit">Access Admin Dashboard</button>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="hero-cta-grid">
                <div className="card hero-signup-card">
                  <p className="panel-title">🎁 Join the Loyalty Club</p>
                  <p className="small">Create your account in seconds and start earning cashback on every visit. Your wallet grows with each purchase.</p>
                  <form id="join-form" onSubmit={handleJoin} className="stack">
                    <input placeholder="Full name" value={joinForm.name} onChange={(e) => setJoinForm({ ...joinForm, name: e.target.value })} required />
                    <input placeholder="Phone number" value={joinForm.phone} onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value })} required />
                    <input placeholder="Email (optional)" value={joinForm.email} onChange={(e) => setJoinForm({ ...joinForm, email: e.target.value })} />
                    <button type="submit">Create My Account</button>
                  </form>
                </div>

                <div className="card hero-lookup-card">
                  <h3>👤 Already a Member?</h3>
                  <p>Enter your customer ID to access your loyalty dashboard, check your wallet balance, and view your rewards progress.</p>
                  <form onSubmit={handleLookup} className="stack">
                    <input placeholder="Customer ID (e.g., IKH-000001)" value={customerIdInput} onChange={(e) => setCustomerIdInput(e.target.value)} required />
                    <button type="submit">Open My Dashboard</button>
                  </form>
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-panel">
                  <p className="panel-title">📈 Your Rewards Journey</p>
                  <div className="level-progress">
                    <div className="level-step">
                      <span className="level-badge">Level 1</span>
                      <span className="level-detail">1-5 visits • 1% cashback</span>
                    </div>
                    <div className="level-step">
                      <span className="level-badge">Level 2</span>
                      <span className="level-detail">6-15 visits • 2% cashback</span>
                    </div>
                    <div className="level-step">
                      <span className="level-badge">Level 3</span>
                      <span className="level-detail">16-25 visits • 3% cashback</span>
                    </div>
                    <div className="level-step">
                      <span className="level-badge">Level 4</span>
                      <span className="level-detail">26-35 visits • 4% cashback</span>
                    </div>
                    <div className="level-step">
                      <span className="level-badge level-vip">Level 5</span>
                      <span className="level-detail">36+ visits • 5% cashback</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {appMode === 'customer' && (
          <section className="view-grid">
            <div className="card">
              <h2>Customer dashboard</h2>
              <p>Welcome back. Your dashboard shows your current cashback level, wallet balance, total spending, and visit count.</p>
              <form onSubmit={handleLookup} className="stack inline-form">
                <input placeholder="Customer ID" value={customerIdInput} onChange={(e) => setCustomerIdInput(e.target.value)} required />
                <button type="submit">Load my profile</button>
              </form>
            </div>

            <div className="card loyalty-card">
              <h3>Your loyalty card</h3>
              {customer ? (
                <>
                  <div className="loyalty-card-body">
                    <div>
                      <p className="eyebrow">Member</p>
                      <h4>{customer.name}</h4>
                      <p className="small">Customer ID</p>
                      <p className="id-chip">{customer.customerId}</p>
                    </div>
                    <div className="loyalty-metrics">
                      <div>
                        <span>Level</span>
                        <strong>{LEVEL_DETAILS[customer.currentLevel]?.label || `Level ${customer.currentLevel || 1}`}</strong>
                      </div>
                      <div>
                        <span>Visits</span>
                        <strong>{customer.visits}</strong>
                      </div>
                      <div>
                        <span>Wallet</span>
                        <strong>{formatRwf(customer.walletBalance)}</strong>
                      </div>
                      <div>
                        <span>Total spend</span>
                        <strong>{formatRwf(customer.totalSpent)}</strong>
                      </div>
                    </div>
                  </div>
                  <p className="small">Phone: {customer.phone}</p>
                  <p className="small">Cashback rate: {LEVEL_DETAILS[customer.currentLevel]?.cashbackRate || 1}%</p>
                  {qrCode ? <img src={qrCode} alt="QR code" className="qr" /> : null}
                </>
              ) : (
                <p>Join to receive your customer ID and QR card.</p>
              )}
            </div>

            <div className="card">
              <h3>Transaction history</h3>
              {transactions.length ? (
                <div className="stack">
                  {transactions.map((item) => (
                    <div key={item._id} className="reward-item">
                      <strong>{item.type === 'wallet_redeem' ? 'Wallet redeemed' : 'Purchase'}</strong>
                      <p>{new Date(item.date).toLocaleString()}</p>
                      <span>
                        Bill: {formatRwf(item.amount)} • Cashback: {formatRwf(item.cashbackEarned)} • Wallet used: {formatRwf(item.walletUsed)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No activity yet. Your purchases will appear here.</p>
              )}
            </div>

            <div className="card">
              <h3>Level guide</h3>
              <div className="stack">
                {Object.entries(LEVEL_DETAILS).map(([level, details]) => (
                  <div key={level} className="reward-item">
                    <strong>{details.label}</strong>
                    <p>{details.range}</p>
                    <span>{details.cashbackRate}% cashback on each bill</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {appMode === 'staff' && (
          <section className="view-grid">
            <div className="card">
              <h2>Staff Dashboard</h2>
              <p>Use the customer ID to process a bill. The wallet balance is automatically applied before the remaining bill is charged.</p>
              <div className="stats-row">
                <div className="stat-box">
                  <strong>{customers.length}</strong>
                  <span>Customers</span>
                </div>
                <div className="stat-box">
                  <strong>{formatRwf(stats.totalSpent)}</strong>
                  <span>Total Spend</span>
                </div>
                <div className="stat-box">
                  <strong>{stats.totalVisits}</strong>
                  <span>Visits</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Find customer by ID</h3>
              <form onSubmit={handleStaffLookup} className="stack">
                <input placeholder="Customer ID" value={staffLookupInput} onChange={(e) => setStaffLookupInput(e.target.value)} required />
                <button type="submit">Load customer</button>
              </form>
              <p className="small">Staff can use the customer ID shown on the loyalty card to look up the account.</p>
            </div>

            <div className="card">
              <h3>Process purchase</h3>
              <form onSubmit={handlePurchase} className="stack">
                <input placeholder="Customer ID" value={purchaseForm.customerId} onChange={(e) => setPurchaseForm({ ...purchaseForm, customerId: e.target.value })} required />
                <input type="number" placeholder="Bill amount in RWF" value={purchaseForm.amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, amount: e.target.value })} required />
                <button type="submit">Process bill</button>
              </form>
            </div>

            <div className="card wide">
              <h3>Customer list</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>ID</th>
                      <th>Level</th>
                      <th>Wallet</th>
                      <th>Spend</th>
                      <th>Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>{item.customerId}</td>
                        <td>{LEVEL_DETAILS[item.currentLevel]?.label || `Level ${item.currentLevel || 1}`}</td>
                        <td>{formatRwf(item.walletBalance)}</td>
                        <td>{formatRwf(item.totalSpent)}</td>
                        <td>{item.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {appMode === 'admin' && (
          <section className="view-grid">
            <div className="card">
              <h2>Admin Dashboard</h2>
              <p>Monitor the level-based cashback system and wallet balance across the entire customer base.</p>
            </div>

            <div className="card">
              <h3>Create admin or staff user</h3>
              <form onSubmit={handleCreateUser} className="stack">
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <input placeholder="Username" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
                <input type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
                <input type="email" placeholder="Email (optional)" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                <button type="submit">Add user</button>
              </form>
            </div>

            <div className="card">
              <h3>Staff & admin users</h3>
              {editingUser ? (
                <form onSubmit={handleUpdateUser} className="stack">
                  <h4>Edit user: {editingUser.username}</h4>
                  <select value={editUserForm.role} onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <input placeholder="Username" value={editUserForm.username} onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })} required />
                  <input type="password" placeholder="New password (leave blank to keep current)" value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} />
                  <input type="email" placeholder="Email" value={editUserForm.email} onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} />
                  <div className="inline-form">
                    <button type="submit">Update user</button>
                    <button type="button" onClick={() => { setEditingUser(null); setEditUserForm({ id: '', role: '', username: '', password: '', email: '' }); }}>Cancel</button>
                  </div>
                </form>
              ) : users.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Role</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td>{user.role}</td>
                          <td>{user.username}</td>
                          <td>{user.email || '—'}</td>
                          <td>
                            <div className="inline-form">
                              <button onClick={() => handleEditUser(user)}>Edit</button>
                              <button onClick={() => handleDeleteUser(user._id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No users created yet.</p>
              )}
            </div>

            <div className="card">
              <h3>Top wallet holders</h3>
              {topCustomers.map((customerItem, index) => (
                <div key={customerItem._id} className="reward-item">
                  <strong>#{index + 1} {customerItem.name}</strong>
                  <p>{customerItem.customerId}</p>
                  <span>{LEVEL_DETAILS[customerItem.currentLevel]?.label || `Level ${customerItem.currentLevel || 1}`} • {formatRwf(customerItem.walletBalance)}</span>
                </div>
              ))}
            </div>

            <div className="card wide">
              <h3>Customer overview</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Customer ID</th>
                      <th>Level</th>
                      <th>Wallet</th>
                      <th>Spend</th>
                      <th>Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>{item.customerId}</td>
                        <td>{LEVEL_DETAILS[item.currentLevel]?.label || `Level ${item.currentLevel || 1}`}</td>
                        <td>{formatRwf(item.walletBalance)}</td>
                        <td>{formatRwf(item.totalSpent)}</td>
                        <td>{item.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
