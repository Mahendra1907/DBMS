// Admin Dashboard JavaScript

const API_BASE = '/api';
let statusChart = null;

// Check authentication on load
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = 'admin-login.html';
        return;
    }

    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    document.getElementById('adminName').textContent = `Welcome, ${user.name || 'Admin'}`;

    loadDashboard();
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = 'admin-login.html';
});

// Tab navigation
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'border-blue-600', 'text-blue-600');
        btn.classList.add('text-gray-500', 'hover:text-gray-700');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    const btn = document.getElementById(`tab-${tabName}`);
    btn.classList.add('active', 'border-blue-600', 'text-blue-600');
    btn.classList.remove('text-gray-500');

  // Load tab-specific data
  if (tabName === 'parcels') {
    loadParcels();
    // Sync sortBy dropdown with sortOrder
    document.getElementById('sortBy').value = sortOrder.column;
  } else if (tabName === 'couriers') {
        loadCouriers();
    } else if (tabName === 'analytics') {
        loadAnalytics();
    }
}

// Load dashboard statistics
async function loadDashboard() {
    try {
        const stats = await fetchData('/admin/statistics');
        
        const statsCards = document.getElementById('statsCards');
        statsCards.innerHTML = `
            <div class="card">
                <p class="text-gray-600 mb-1">Total Parcels</p>
                <p class="text-3xl font-bold text-gray-800">${stats.total_parcels || 0}</p>
            </div>
            <div class="card">
                <p class="text-gray-600 mb-1">Pending</p>
                <p class="text-3xl font-bold text-yellow-600">
                    ${stats.status_breakdown?.find(s => s.status === 'Pending')?.count || 0}
                </p>
            </div>
            <div class="card">
                <p class="text-gray-600 mb-1">In Transit</p>
                <p class="text-3xl font-bold text-blue-600">
                    ${stats.status_breakdown?.find(s => s.status === 'In Transit')?.count || 0}
                </p>
            </div>
            <div class="card">
                <p class="text-gray-600 mb-1">Delivered</p>
                <p class="text-3xl font-bold text-green-600">
                    ${stats.status_breakdown?.find(s => s.status === 'Delivered')?.count || 0}
                </p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Sort state
let sortOrder = { column: 'date_created', order: 'DESC' };

// Debounce search
let searchTimeout;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadParcels();
    }, 500);
}

// Toggle sort
function toggleSort(column) {
    if (sortOrder.column === column) {
        sortOrder.order = sortOrder.order === 'ASC' ? 'DESC' : 'ASC';
    } else {
        sortOrder.column = column;
        sortOrder.order = 'DESC';
    }
    loadParcels();
}

// Clear filters
function clearFilters() {
    document.getElementById('parcelSearch').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('sortBy').value = 'date_created';
    sortOrder = { column: 'date_created', order: 'DESC' };
    loadParcels();
}

// Export parcels
async function exportParcels(format) {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/admin/parcels/export?format=${format}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        if (format === 'csv') {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'parcels.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'parcels.json';
            a.click();
            window.URL.revokeObjectURL(url);
        }
        
        alert(`Parcels exported successfully as ${format.toUpperCase()}!`);
    } catch (error) {
        alert('Error exporting parcels: ' + error.message);
    }
}

// Load parcels with filters
async function loadParcels() {
    const loadingDiv = document.getElementById('parcelsLoading');
    const tableWrapper = document.getElementById('parcelsTableWrapper');
    const tbody = document.getElementById('parcelsTableBody');
    
    loadingDiv.classList.remove('hidden');
    tableWrapper.classList.add('hidden');
    
    try {
        const search = document.getElementById('parcelSearch').value;
        const status = document.getElementById('statusFilter').value;
        const sortBy = document.getElementById('sortBy').value || sortOrder.column;
        
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        params.append('sortBy', sortBy);
        params.append('order', sortOrder.order);
        
        const parcels = await fetchData(`/admin/parcels?${params.toString()}`);
        
        // Update count
        document.getElementById('parcelCount').textContent = `${parcels.length} parcel(s) found`;
        
        loadingDiv.classList.add('hidden');
        
        if (parcels.length === 0) {
            tableWrapper.classList.remove('hidden');
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">No parcels found. Try adjusting your filters.</td></tr>';
            return;
        }

        tableWrapper.classList.remove('hidden');
        
        tbody.innerHTML = parcels.map(parcel => `
            <tr class="hover:bg-blue-50 transition-colors">
                <td class="font-semibold text-blue-600">${parcel.tracking_id}</td>
                <td>${parcel.sender_name}</td>
                <td>${parcel.receiver_name}</td>
                <td>${parcel.origin}</td>
                <td>${parcel.destination}</td>
                <td>
                    <span class="status-badge ${
                        parcel.status === 'Delivered' ? 'status-delivered' :
                        parcel.status === 'In Transit' ? 'status-in-transit' : 'status-pending'
                    }">${parcel.status}</span>
                </td>
                <td class="text-sm text-gray-600">${new Date(parcel.date_created).toLocaleDateString()}</td>
                <td>
                    <div class="flex space-x-2">
                        <button onclick="openStatusModal(${parcel.parcel_id})" 
                                class="text-green-600 hover:text-green-700 text-sm font-medium">📝 Update</button>
                        <button onclick="deleteParcel(${parcel.parcel_id})" 
                                class="text-red-600 hover:text-red-700 text-sm font-medium">🗑️ Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading parcels:', error);
        loadingDiv.classList.add('hidden');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-red-500">Error loading parcels. Please try again.</td></tr>';
    }
}

// Load couriers
async function loadCouriers() {
    try {
        const couriers = await fetchData('/admin/couriers');
        const tbody = document.getElementById('couriersTableBody');
        
        if (couriers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No couriers found</td></tr>';
            return;
        }

        tbody.innerHTML = couriers.map(courier => `
            <tr>
                <td class="font-semibold">${courier.name}</td>
                <td>${courier.email}</td>
                <td>${courier.phone || 'N/A'}</td>
                <td>${courier.vehicle_type || 'N/A'}</td>
                <td>
                    <span class="status-badge ${courier.status === 'available' ? 'status-in-transit' : 'status-pending'}">
                        ${courier.status || 'available'}
                    </span>
                </td>
                <td>
                    <button onclick="deleteCourier(${courier.courier_id})" 
                            class="text-red-600 hover:text-red-700 text-sm">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading couriers:', error);
    }
}

// Load analytics
async function loadAnalytics() {
    try {
        const stats = await fetchData('/admin/statistics');
        
        // Update status chart
        const ctx = document.getElementById('statusChart').getContext('2d');
        if (statusChart) {
            statusChart.destroy();
        }
        
        const statusData = stats.status_breakdown || [];
        statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: statusData.map(s => s.status),
                datasets: [{
                    data: statusData.map(s => s.count),
                    backgroundColor: [
                        '#FCD34D', // yellow for pending
                        '#60A5FA', // blue for in transit
                        '#34D399'  // green for delivered
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true
            }
        });

        // Recent parcels
        const recentDiv = document.getElementById('recentParcels');
        const recent = stats.recent_parcels || [];
        if (recent.length === 0) {
            recentDiv.innerHTML = '<p class="text-gray-500">No recent parcels</p>';
        } else {
            recentDiv.innerHTML = recent.map(parcel => `
                <div class="border-l-4 border-blue-500 pl-4 py-2">
                    <p class="font-semibold text-gray-800">${parcel.tracking_id}</p>
                    <p class="text-sm text-gray-600">${parcel.sender_name} → ${parcel.receiver_name}</p>
                    <p class="text-xs text-gray-500">${new Date(parcel.date_created).toLocaleString()}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Parcel modals
function openAddParcelModal() {
    document.getElementById('parcelModalTitle').textContent = 'Add New Parcel';
    document.getElementById('parcelForm').reset();
    document.getElementById('parcelId').value = '';
    loadCouriersForSelect();
    document.getElementById('parcelModal').classList.remove('hidden');
}


function closeParcelModal() {
    document.getElementById('parcelModal').classList.add('hidden');
}

async function loadCouriersForSelect() {
    try {
        const couriers = await fetchData('/admin/couriers');
        const select = document.getElementById('courierId');
        select.innerHTML = '<option value="">Select Courier</option>' +
            couriers.map(c => `<option value="${c.courier_id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading couriers:', error);
    }
}

// Parcel form submission
document.getElementById('parcelForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const parcelId = document.getElementById('parcelId').value;
    const data = {
        sender_name: document.getElementById('senderName').value,
        receiver_name: document.getElementById('receiverName').value,
        sender_email: document.getElementById('senderEmail').value,
        receiver_email: document.getElementById('receiverEmail').value,
        sender_phone: document.getElementById('senderPhone').value,
        receiver_phone: document.getElementById('receiverPhone').value,
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        weight: document.getElementById('weight').value || null,
        description: document.getElementById('description').value,
        courier_id: document.getElementById('courierId').value || null
    };

    try {
        await postData('/admin/parcels', data);
        closeParcelModal();
        loadParcels();
        loadDashboard();
        alert('Parcel created successfully!');
    } catch (error) {
        alert('Error saving parcel: ' + error.message);
    }
});

// Status modal
function openStatusModal(id) {
    document.getElementById('statusParcelId').value = id;
    document.getElementById('statusForm').reset();
    document.getElementById('statusParcelId').value = id; // Reset form but keep parcel ID
    document.getElementById('statusModal').classList.remove('hidden');
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.add('hidden');
}

document.getElementById('statusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const parcelId = document.getElementById('statusParcelId').value;
    const data = {
        status: document.getElementById('status').value,
        location: document.getElementById('location').value,
        remarks: document.getElementById('remarks').value
    };

    try {
        await putData(`/admin/parcels/${parcelId}`, data);
        closeStatusModal();
        loadParcels();
        loadDashboard();
        alert('Status updated successfully!');
    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
});

// Courier modal
function openAddCourierModal() {
    document.getElementById('courierForm').reset();
    document.getElementById('courierModal').classList.remove('hidden');
}

function closeCourierModal() {
    document.getElementById('courierModal').classList.add('hidden');
}

document.getElementById('courierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        name: document.getElementById('courierName').value,
        email: document.getElementById('courierEmail').value,
        phone: document.getElementById('courierPhone').value,
        vehicle_type: document.getElementById('vehicleType').value
    };

    try {
        await postData('/admin/couriers', data);
        closeCourierModal();
        loadCouriers();
        loadDashboard();
        alert('Courier added successfully!');
    } catch (error) {
        alert('Error adding courier: ' + error.message);
    }
});

// Delete functions
async function deleteParcel(id) {
    if (!confirm('Are you sure you want to delete this parcel?')) return;
    
    try {
        await deleteData(`/admin/parcels/${id}`);
        loadParcels();
        loadDashboard();
        alert('Parcel deleted successfully!');
    } catch (error) {
        alert('Error deleting parcel: ' + error.message);
    }
}

async function deleteCourier(id) {
    if (!confirm('Are you sure you want to delete this courier?')) return;
    
    try {
        await deleteData(`/admin/couriers/${id}`);
        loadCouriers();
        loadDashboard();
        alert('Courier deleted successfully!');
    } catch (error) {
        alert('Error deleting courier: ' + error.message);
    }
}

// Helper functions for API calls
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
    };
}

async function fetchData(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: getAuthHeaders()
    });
    
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            window.location.href = 'admin-login.html';
        }
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return await response.json();
}

async function postData(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return await response.json();
}

async function putData(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return await response.json();
}

async function deleteData(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return await response.json();
}

// Initialize on load
showTab('parcels');

