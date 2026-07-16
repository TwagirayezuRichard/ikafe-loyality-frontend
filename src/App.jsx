import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function App() {
  const [appMode, setAppMode] = useState('landing');
  const [customers, setCustomers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [qrCode, setQrCode] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [staffLookupInput, setStaffLookupInput] = useState('');

  const [joinForm, setJoinForm] = useState({ name: '', phone: '', email: '' });
  const [pointsForm, setPointsForm] = useState({ customerId: '', amount: '' });
  const [redeemForm, setRedeemForm] = useState({ customerId: '', pointsRequired: '' });
  const [rewardForm, setRewardForm] = useState({ name: '', description: '', pointsRequired: '' });
  const [userForm, setUserForm] = useState({ role: 'staff', username: '', password: '', email: '' });
  const [users, setUsers] = useState([]);
  const [loginMode, setLoginMode] = useState(null);
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

  const loadRewards = async () => {
    try {
      const res = await fetch(`${API_BASE}/rewards`);
      const data = await res.json();
      setRewards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
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
    loadRewards();
    if (authToken) {
      loadCustomers();
      loadUsers();
    }
  }, [authToken]);

  useEffect(() => {
    const saved = localStorage.getItem("ikafeAuth");
    if (saved) {
      try {
        const { token, user } = JSON.parse(saved);
        if (token && user) {
          setAuthToken(token);
          setAuthUser(user);
        }
      } catch (error) {
        console.error("Failed to restore auth", error);
      }
    }
  }, []);

  const stats = useMemo(() => {
    const totalPoints = customers.reduce((sum, item) => sum + Number(item.points || 0), 0);
    const totalSpent = customers.reduce((sum, item) => sum + Number(item.totalSpent || 0), 0);
    const totalVisits = customers.reduce((sum, item) => sum + Number(item.visits || 0), 0);
    return { totalPoints, totalSpent, totalVisits };
  }, [customers]);

  const topCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
      .slice(0, 5);
  }, [customers]);

  const showMessage = (type, text) => setMessage({ type, text });

  const syncCustomerState = async (customerData, generatedQrCode = '') => {
    setCustomer(customerData);
    setQrCode(generatedQrCode);
    setPointsForm((prev) => ({ ...prev, customerId: customerData.customerId }));
    setRedeemForm((prev) => ({ ...prev, customerId: customerData.customerId }));
    await loadTransactions(customerData.customerId);
  };

  const customerRewardMessage = useMemo(() => {
    if (!customer || !rewards.length) return '';
    const eligibleReward = [...rewards]
      .filter((reward) => customer.points >= reward.pointsRequired)
      .sort((a, b) => b.pointsRequired - a.pointsRequired)[0];

    return eligibleReward
      ? `Congratulations ${customer.name}! You now have ${customer.points} points and can take the reward: ${eligibleReward.name}. Please claim it now.`
      : '';
  }, [customer, rewards]);

  const handleReturnHome = () => {
    setAppMode('landing');
    setCustomer(null);
    setQrCode('');
    setTransactions([]);
    setCustomerIdInput('');
    setStaffLookupInput('');
    setPointsForm({ customerId: '', amount: '' });
    setRedeemForm({ customerId: '', pointsRequired: '' });
    setJoinForm({ name: '', phone: '', email: '' });
    setAuthToken('');
    setAuthUser(null);
    localStorage.removeItem('ikafeAuth');
    setMessage({ type: '', text: '' });
  };

  const goToStaff = () => {
    setLoginMode('staff');
    setMessage({ type: '', text: '' });
  };

  const goToAdmin = () => {
    setLoginMode('admin');
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
      setPointsForm((prev) => ({ ...prev, customerId: data.customerId }));
      setRedeemForm((prev) => ({ ...prev, customerId: data.customerId }));
      showMessage('success', `Customer loaded for checkout`);
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleAddPoints = async (event) => {
    event.preventDefault();
    if (!authToken) {
      return showMessage('error', 'Staff or admin login required');
    }

    try {
      const res = await fetch(`${API_BASE}/loyalty/add-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ customerId: pointsForm.customerId, amount: Number(pointsForm.amount) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to add points');
      setPointsForm((prev) => ({ ...prev, amount: '' }));
      showMessage('success', data.message || 'Points added');
      loadCustomers();
      if (pointsForm.customerId) {
        const customerRes = await fetch(`${API_BASE}/customers/${pointsForm.customerId}`);
        const customerData = await customerRes.json();
        await syncCustomerState(customerData);
      }
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleRedeem = async (event) => {
    event.preventDefault();
    if (!authToken) {
      return showMessage('error', 'Staff or admin login required');
    }

    try {
      const res = await fetch(`${API_BASE}/loyalty/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ customerId: redeemForm.customerId, pointsRequired: Number(redeemForm.pointsRequired) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to redeem');
      setRedeemForm((prev) => ({ ...prev, pointsRequired: '' }));
      showMessage('success', data.message || 'Reward redeemed');
      loadCustomers();
      if (redeemForm.customerId) {
        const customerRes = await fetch(`${API_BASE}/customers/${redeemForm.customerId}`);
        const customerData = await customerRes.json();
        await syncCustomerState(customerData);
      }
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleCreateReward = async (event) => {
    event.preventDefault();
    if (!authToken) {
      return showMessage('error', 'Admin login required');
    }

    try {
      const res = await fetch(`${API_BASE}/rewards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: rewardForm.name,
          description: rewardForm.description,
          pointsRequired: Number(rewardForm.pointsRequired)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reward could not be created');
      setRewardForm({ name: '', description: '', pointsRequired: '' });
      showMessage('success', 'Reward created');
      loadRewards();
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

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h1>Ikafé Loyalty</h1>
            <p>Scan, join, and view your customer dashboard.</p>
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
          <p>{stats.totalPoints} loyalty points</p>
          <p>{rewards.length} active rewards</p>
        </div>
      </aside>

      <main className="main-content">
        {message.text ? (
          <div className={`banner ${message.type}`}>{message.text}</div>
        ) : null}

        {appMode === 'landing' && (
          <section className="view-grid home-hero">
            <div className="card hero-card wide">
              <div className="hero-copy">
                <p className="eyebrow">Join the Ikafehaven community</p>
                <h2>Earn loyalty rewards, scan your QR, and get gifted.</h2>
                <p>Join the large community of Ikafehaven and collect rewards with every visit. Existing members use their ID to access their dashboard, while staff and admin log in securely from the home page.</p>
                <div className="hero-actions">
                  <button className="cta-primary" onClick={() => setAppMode('customer')}>Customer portal</button>
                  <button className="cta-secondary" onClick={goToStaff}>Staff login</button>
                  <button className="cta-secondary" onClick={goToAdmin}>Admin login</button>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-panel">
                  <p className="panel-title">Welcome to Ikafé Loyalty</p>
                  <p>Scan the code, collect points, and take gifts when you hit your next milestone.</p>
                </div>
              </div>
            </div>

            <div className="card dashboard-card">
              <h3>Customer portal</h3>
              <p>Existing members can open their dashboard using their Customer ID. New members can join the program and start earning right away.</p>
              <form onSubmit={handleLookup} className="stack">
                <input placeholder="Your Customer ID" value={customerIdInput} onChange={(e) => setCustomerIdInput(e.target.value)} required />
                <button type="submit">Visit customer dashboard</button>
              </form>
              <div className="divider">or</div>
              <h4>New member? Join now</h4>
              <form onSubmit={handleJoin} className="stack">
                <input placeholder="Full name" value={joinForm.name} onChange={(e) => setJoinForm({ ...joinForm, name: e.target.value })} required />
                <input placeholder="Phone number" value={joinForm.phone} onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value })} required />
                <input placeholder="Email" value={joinForm.email} onChange={(e) => setJoinForm({ ...joinForm, email: e.target.value })} />
                <button type="submit">Join Ikafehaven</button>
              </form>
            </div>

            <div className="card login-card">
              <h3>Staff and admin login</h3>
              <p>Choose your role and sign in to access the correct dashboard.</p>
              <button type="button" className="role-button" onClick={goToStaff}>Staff login</button>
              <button type="button" className="role-button ghost-button" onClick={goToAdmin}>Admin login</button>
              {loginMode === 'staff' ? (
                <form onSubmit={handleStaffLogin} className="stack login-form">
                  <input placeholder="Staff username" value={staffLogin.username} onChange={(e) => setStaffLogin({ ...staffLogin, username: e.target.value })} required />
                  <input type="password" placeholder="Password" value={staffLogin.password} onChange={(e) => setStaffLogin({ ...staffLogin, password: e.target.value })} required />
                  <button type="submit">Continue to staff</button>
                </form>
              ) : null}
              {loginMode === 'admin' ? (
                <form onSubmit={handleAdminLogin} className="stack login-form">
                  <input placeholder="Admin username" value={adminLogin.username} onChange={(e) => setAdminLogin({ ...adminLogin, username: e.target.value })} required />
                  <input type="password" placeholder="Password" value={adminLogin.password} onChange={(e) => setAdminLogin({ ...adminLogin, password: e.target.value })} required />
                  <button type="submit">Continue to admin</button>
                </form>
              ) : null}
              {authUser ? (
                <div className="stack auth-summary">
                  <p>Signed in as <strong>{authUser.username}</strong></p>
                  <p>Role: <strong>{authUser.role}</strong></p>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {appMode === 'customer' && (
          <section className="view-grid">
            <div className="card">
              <h2>Customer dashboard</h2>
              <p>Welcome back. Your loyalty dashboard shows points, visits, and available rewards.</p>
              {customerRewardMessage ? (
                <div className="banner success">{customerRewardMessage}</div>
              ) : null}
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
                        <span>Points</span>
                        <strong>{customer.points}</strong>
                      </div>
                      <div>
                        <span>Visits</span>
                        <strong>{customer.visits}</strong>
                      </div>
                      <div>
                        <span>Spent</span>
                        <strong>${customer.totalSpent}</strong>
                      </div>
                    </div>
                  </div>
                  <p className="small">Phone: {customer.phone}</p>
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
                      <strong>{item.type === 'redeem' ? 'Reward redeemed' : 'Purchase'}</strong>
                      <p>{new Date(item.date).toLocaleString()}</p>
                      <span>{item.pointsEarned >= 0 ? `+${item.pointsEarned}` : item.pointsEarned} pts</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No activity yet. Your purchases will appear here.</p>
              )}
            </div>

            <div className="card">
              <h3>Available rewards</h3>
              {rewards.length ? (
                rewards.map((reward) => (
                  <div key={reward._id} className="reward-item">
                    <strong>{reward.name}</strong>
                    <p>{reward.description}</p>
                    <span>{reward.pointsRequired} pts</span>
                  </div>
                ))
              ) : (
                <p>Rewards will appear here once the admin adds them.</p>
              )}
            </div>
          </section>
        )}

        {appMode === 'staff' && (
          <section className="view-grid">
            <div className="card">
              <h2>Staff Dashboard</h2>
              <p>Enter a customer ID, then add the purchase amount to update points.</p>
              <div className="stats-row">
                <div className="stat-box">
                  <strong>{customers.length}</strong>
                  <span>Customers</span>
                </div>
                <div className="stat-box">
                  <strong>${stats.totalSpent}</strong>
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
              <h3>Check out purchase</h3>
              <form onSubmit={handleAddPoints} className="stack">
                <input placeholder="Customer ID" value={pointsForm.customerId} onChange={(e) => setPointsForm({ ...pointsForm, customerId: e.target.value })} required />
                <input type="number" placeholder="Bill amount" value={pointsForm.amount} onChange={(e) => setPointsForm({ ...pointsForm, amount: e.target.value })} required />
                <button type="submit">Calculate points</button>
              </form>
            </div>

            <div className="card">
              <h3>Redeem reward</h3>
              <form onSubmit={handleRedeem} className="stack">
                <input placeholder="Customer ID" value={redeemForm.customerId} onChange={(e) => setRedeemForm({ ...redeemForm, customerId: e.target.value })} required />
                <input type="number" placeholder="Points to spend" value={redeemForm.pointsRequired} onChange={(e) => setRedeemForm({ ...redeemForm, pointsRequired: e.target.value })} required />
                <button type="submit">Redeem</button>
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
                      <th>Points</th>
                      <th>Spend</th>
                      <th>Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>{item.customerId}</td>
                        <td>{item.points}</td>
                        <td>${item.totalSpent}</td>
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
              <p>Manage rewards and monitor the strongest loyalty members.</p>
              <form onSubmit={handleCreateReward} className="stack">
                <input placeholder="Reward name" value={rewardForm.name} onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })} required />
                <input placeholder="Description" value={rewardForm.description} onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })} required />
                <input type="number" placeholder="Points required" value={rewardForm.pointsRequired} onChange={(e) => setRewardForm({ ...rewardForm, pointsRequired: e.target.value })} required />
                <button type="submit">Create reward</button>
              </form>
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
              {users.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Role</th>
                        <th>Username</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td>{user.role}</td>
                          <td>{user.username}</td>
                          <td>{user.email || '—'}</td>
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
              <h3>Top customers</h3>
              {topCustomers.map((customerItem, index) => (
                <div key={customerItem._id} className="reward-item">
                  <strong>#{index + 1} {customerItem.name}</strong>
                  <p>{customerItem.customerId}</p>
                  <span>{customerItem.points} pts • ${customerItem.totalSpent}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Available rewards</h3>
              {rewards.map((reward) => (
                <div key={reward._id} className="reward-item">
                  <strong>{reward.name}</strong>
                  <p>{reward.description}</p>
                  <span>{reward.pointsRequired} pts</span>
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
                      <th>Points</th>
                      <th>Spend</th>
                      <th>Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>{item.customerId}</td>
                        <td>{item.points}</td>
                        <td>${item.totalSpent}</td>
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
