
import supabase from './supabaseClient.js';
import * as UI from './ui.js';
import { formatDate, isOverdue, calculatePromiseDifference } from './utils.js';

// --- DATA STORE ---
let teamMembers = [];
let tasks = [];
let projects = [];

// --- CHART & CALENDAR REFS ---
const statusChart = { current: null };
const priorityChart = { current: null };
const ownerChart = { current: null };
const calendar = { current: null };

// --- STATE MANAGEMENT ---
let currentFilters = { search: '', owner: 'all', status: 'all', dateStart: null, dateEnd: null, project: 'all', priority: 'all' };
let currentSort = { key: 'promise_date', order: 'asc' };

// --- ELEMENT SELECTORS ---
const filterOwner = document.getElementById('filter-owner');
const filterStatus = document.getElementById('filter-status');
const filterProject = document.getElementById('filter-project');
const filterPriority = document.getElementById('filter-priority');
const filterDateStart = document.getElementById('filter-date-start');
const filterDateEnd = document.getElementById('filter-date-end');
const searchInput = document.getElementById('search-input');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const teamModal = document.getElementById('team-modal');
const teamForm = document.getElementById('team-form');
const projectModal = document.getElementById('project-modal');
const projectForm = document.getElementById('project-form');
const modalTitle = document.getElementById('modal-title');
const modalSubmitBtn = document.getElementById('modal-submit-btn');
const ownerSelect = document.getElementById('task-owner');
const ownerHelperText = document.getElementById('owner-helper-text');
const calendarEl = document.getElementById('calendar');

// --- DATA FETCHING ---
const fetchData = async () => {
    // Enable Realtime Subscriptions
    supabase.channel('public:all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
            handleRealtimeUpdate('tasks', payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, payload => {
            handleRealtimeUpdate('team_members', payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
            handleRealtimeUpdate('projects', payload);
        })
        .subscribe();

    // Initial Fetch
    const { data: tasksData, error: taskError } = await supabase.from('tasks').select('*');
    if (taskError) console.error('Error fetching tasks:', taskError);
    else tasks = tasksData || [];

    const { data: teamData, error: teamError } = await supabase.from('team_members').select('*');
    if (teamError) console.error('Error fetching team:', teamError);
    else teamMembers = teamData || [];

    const { data: projectsData, error: projectError } = await supabase.from('projects').select('*');
    if (projectError) console.error('Error fetching projects:', projectError);
    else projects = projectsData || [];

    rerenderAll();
};

const handleRealtimeUpdate = (table, payload) => {
    console.log(`Realtime update on ${table}:`, payload);
    const { eventType, new: newRecord, old: oldRecord } = payload;
    let collection;

    if (table === 'tasks') collection = tasks;
    if (table === 'team_members') collection = teamMembers;
    if (table === 'projects') collection = projects;

    if (eventType === 'INSERT') {
        collection.push(newRecord);
    } else if (eventType === 'UPDATE') {
        const index = collection.findIndex(item => item.id === newRecord.id);
        if (index !== -1) collection[index] = newRecord;
    } else if (eventType === 'DELETE') {
        const index = collection.findIndex(item => item.id === oldRecord.id);
        if (index !== -1) collection.splice(index, 1);
    }

    // Update local references
    if (table === 'tasks') tasks = collection;
    if (table === 'team_members') teamMembers = collection;
    if (table === 'projects') projects = collection;

    rerenderAll();
};

// --- FILTERING & SORTING LOGIC ---
const getFilteredTasks = () => {
    return tasks.filter(task => {
        const searchMatch = task.description.toLowerCase().includes(currentFilters.search.toLowerCase()) ||
            (task.project && task.project.toLowerCase().includes(currentFilters.search.toLowerCase())) ||
            task.owner.toLowerCase().includes(currentFilters.search.toLowerCase());
        const ownerMatch = currentFilters.owner === 'all' || task.owner === currentFilters.owner;
        const statusMatch = currentFilters.status === 'all' || (currentFilters.status === 'Overdue' ? isOverdue(task) : (task.status === currentFilters.status && !isOverdue(task)));
        const projectMatch = currentFilters.project === 'all' || task.project === currentFilters.project;
        const priorityMatch = currentFilters.priority === 'all' || task.priority === currentFilters.priority;

        const taskDate = new Date(task.assigned_date + 'T00:00:00');
        const startDate = currentFilters.dateStart ? new Date(currentFilters.dateStart + 'T00:00:00') : null;
        const endDate = currentFilters.dateEnd ? new Date(currentFilters.dateEnd + 'T00:00:00') : null;
        const dateMatch = (!startDate || taskDate >= startDate) && (!endDate || taskDate <= endDate);

        return searchMatch && ownerMatch && statusMatch && dateMatch && projectMatch && priorityMatch;
    });
};

const sortTasks = (filteredTasks) => {
    filteredTasks.sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];

        if (currentSort.key === 'promise_date' || currentSort.key === 'assigned_date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }

        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });
    return filteredTasks;
};

// --- RENDER FUNCTION ---
const rerenderAll = () => {
    UI.populateDropdowns(teamMembers, projects, currentFilters);

    let filteredTasks = getFilteredTasks();

    const relevantTasks = filteredTasks; // For summary cards
    const totalTasks = relevantTasks.length;
    const pendingTasks = relevantTasks.filter(t => t.status === 'Pending' && !isOverdue(t)).length;
    const inProgressTasks = relevantTasks.filter(t => t.status === 'In Progress' && !isOverdue(t)).length;
    const overdueTasks = relevantTasks.filter(isOverdue).length;

    UI.renderSummaryCards(totalTasks, pendingTasks, inProgressTasks, overdueTasks);

    filteredTasks = sortTasks(filteredTasks);
    UI.renderTasks(filteredTasks, currentSort, attachActionListeners, updateSortIcons);
    UI.renderTeamMembers(teamMembers, deleteTeamMember);
    UI.renderProjects(projects, deleteProject);
    UI.renderCharts(filteredTasks, statusChart, priorityChart, ownerChart);
    UI.renderCalendar(filteredTasks, calendar);
    UI.renderProjectView(filteredTasks);
};

const updateSortIcons = () => {
    document.querySelectorAll('.sortable .sort-icon').forEach(i => i.textContent = '');
    const activeIcon = document.querySelector(`.sortable[data-sort="${currentSort.key}"] .sort-icon`);
    if (activeIcon) activeIcon.textContent = currentSort.order === 'asc' ? ' ▲' : ' ▼';
};

// --- ACTIONS ---
const deleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) alert('Error deleting task: ' + error.message);
};

const deleteTeamMember = async (id) => {
    if (!confirm('Are you sure?')) return;
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) alert('Error deleting member: ' + error.message);
};

const deleteProject = async (id) => {
    if (!confirm('Are you sure?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) alert('Error deleting project: ' + error.message);
};

const addTeamMember = async (name, designation) => {
    const { error } = await supabase.from('team_members').insert([{ name, designation }]);
    if (error) alert('Error adding member: ' + error.message);
};

const addProject = async (name) => {
    const { error } = await supabase.from('projects').insert([{ name }]);
    if (error) alert('Error adding project: ' + error.message);
};

const attachActionListeners = () => {
    document.querySelectorAll('.delete-btn').forEach(b => b.onclick = e => deleteTask(e.currentTarget.dataset.id));
    document.querySelectorAll('.edit-btn').forEach(b => b.onclick = e => openEditModal(e.currentTarget.dataset.id));
};

// --- MODAL & FORM HANDLERS ---
const openAddTaskModal = () => {
    taskForm.reset();
    const promiseDateInput = document.getElementById('promise-date');
    const today = new Date();
    today.setDate(today.getDate() + 2);
    promiseDateInput.value = formatDate(today);
    modalTitle.textContent = 'Add New Task';
    modalSubmitBtn.textContent = 'Add Task';
    document.getElementById('task-id').value = '';
    ownerSelect.multiple = true;
    ownerSelect.classList.add('h-24');
    ownerHelperText.classList.remove('hidden');
    taskModal.classList.remove('hidden');
};

const openEditModal = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    ownerSelect.multiple = false;
    ownerSelect.classList.remove('h-24');
    ownerHelperText.classList.add('hidden');
    modalTitle.textContent = 'Edit Task';
    modalSubmitBtn.textContent = 'Save Changes';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-project').value = task.project || '';
    document.getElementById('task-description').value = task.description;
    document.getElementById('task-owner').value = task.owner;
    document.getElementById('task-priority').value = task.priority || 'Medium';
    document.getElementById('promise-date').value = task.promise_date;
    document.getElementById('task-status').value = task.status;
    document.getElementById('task-comments').value = task.comments || '';
    taskModal.classList.remove('hidden');
};

taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = e.target['task-id'].value;
    const project = e.target['task-project'].value.trim();
    const description = e.target['task-description'].value.trim();
    const priority = e.target['task-priority'].value;
    const promiseDate = e.target['promise-date'].value;
    const status = e.target['task-status'].value;
    const comments = e.target['task-comments'].value.trim();

    if (id) {
        // Edit mode
        const owner = ownerSelect.value;
        if (!description || !owner || !promiseDate) return;

        const taskData = tasks.find(t => t.id === id);
        const wasDone = taskData.status === 'Done';
        const completedDate = status === 'Done' && !wasDone ? new Date().toISOString().split('T')[0] : (status !== 'Done' && wasDone ? null : taskData.completed_date);

        const { error } = await supabase.from('tasks').update({
            project, description, owner, priority,
            promise_date: promiseDate,
            status, comments,
            completed_date: completedDate
        }).eq('id', id);

        if (error) alert(error.message);

    } else {
        // Add mode (possibly multiple owners)
        const selectedOwners = Array.from(ownerSelect.selectedOptions).map(opt => opt.value);
        if (!description || selectedOwners.length === 0 || !promiseDate) return;

        const assignedDate = new Date().toISOString().split('T')[0];
        const rows = selectedOwners.map(owner => ({
            project, description, owner, priority,
            assigned_date: assignedDate,
            promise_date: promiseDate,
            status, comments,
            completed_date: status === 'Done' ? assignedDate : null
        }));

        const { error } = await supabase.from('tasks').insert(rows);
        if (error) alert(error.message);
    }
    taskModal.classList.add('hidden');
});

teamForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = e.target['member-name'].value.trim();
    const designation = e.target['member-designation'].value.trim();
    if (name && designation) addTeamMember(name, designation);
    e.target.reset();
});

projectForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = e.target['project-name'].value.trim();
    if (name) addProject(name);
    e.target.reset();
});

// --- GENERAL EVENT LISTENERS ---
searchInput.addEventListener('input', e => { currentFilters.search = e.target.value; rerenderAll(); });
filterOwner.addEventListener('change', e => { currentFilters.owner = e.target.value; rerenderAll(); });
filterStatus.addEventListener('change', e => { currentFilters.status = e.target.value; rerenderAll(); });
filterProject.addEventListener('change', e => { currentFilters.project = e.target.value; rerenderAll(); });
filterPriority.addEventListener('change', e => { currentFilters.priority = e.target.value; rerenderAll(); });

const setupDateInput = (input) => {
    input.addEventListener('change', (e) => {
        const dateVal = e.target.value;
        const label = e.target.nextElementSibling;
        if (label) label.style.display = dateVal ? 'none' : 'block';
        e.target.classList.toggle('text-gray-900', !!dateVal);
        if (e.target.id === 'filter-date-start') currentFilters.dateStart = dateVal || null;
        else if (e.target.id === 'filter-date-end') currentFilters.dateEnd = dateVal || null;
        rerenderAll();
    });
};
setupDateInput(filterDateStart);
setupDateInput(filterDateEnd);

document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
        const sortKey = header.dataset.sort;
        // Transform camelCase keys to snake_case for Supabase compatibility in frontend state
        let mappedKey = sortKey;
        if (sortKey === 'promiseDate') mappedKey = 'promise_date';
        if (sortKey === 'assignedDate') mappedKey = 'assigned_date';

        if (currentSort.key === mappedKey) {
            currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.key = mappedKey;
            currentSort.order = 'asc';
        }
        rerenderAll();
    });
});

// Tab Event Listeners
const tabList = document.getElementById('tab-list');
const tabDashboard = document.getElementById('tab-dashboard');
const tabCalendar = document.getElementById('tab-calendar');
const tabProjectView = document.getElementById('tab-project-view');
const tabPanelList = document.getElementById('tab-panel-list');
const tabPanelDashboard = document.getElementById('tab-panel-dashboard');
const tabPanelCalendar = document.getElementById('tab-panel-calendar');
const tabPanelProjectView = document.getElementById('tab-panel-project-view');

const switchTab = (activeTab) => {
    const tabs = { list: tabList, dashboard: tabDashboard, calendar: tabCalendar, projectView: tabProjectView };
    const panels = { list: tabPanelList, dashboard: tabPanelDashboard, calendar: tabPanelCalendar, projectView: tabPanelProjectView };
    Object.keys(tabs).forEach(key => {
        const isActive = key === activeTab;
        tabs[key].classList.toggle('active', isActive);
        panels[key].classList.toggle('hidden', !isActive);
    });
    if (activeTab === 'calendar' && calendar.current) calendar.current.render();
};

tabList.addEventListener('click', () => switchTab('list'));
tabDashboard.addEventListener('click', () => switchTab('dashboard'));
tabCalendar.addEventListener('click', () => switchTab('calendar'));
tabProjectView.addEventListener('click', () => switchTab('projectView'));

// Modal listeners
const openTaskModalBtn = document.getElementById('open-add-task-modal-btn');
const closeTaskModalBtn = document.getElementById('close-task-modal-btn');
const manageTeamBtn = document.getElementById('manage-team-btn');
const closeTeamModalBtn = document.getElementById('close-team-modal-btn');
const manageProjectBtn = document.getElementById('manage-project-btn');
const closeProjectModalBtn = document.getElementById('close-project-modal-btn');

openTaskModalBtn.addEventListener('click', openAddTaskModal);
closeTaskModalBtn.addEventListener('click', () => taskModal.classList.add('hidden'));
taskModal.addEventListener('click', (e) => { if (e.target === taskModal) taskModal.classList.add('hidden'); });

manageTeamBtn.addEventListener('click', () => teamModal.classList.remove('hidden'));
closeTeamModalBtn.addEventListener('click', () => teamModal.classList.add('hidden'));
teamModal.addEventListener('click', (e) => { if (e.target === teamModal) teamModal.classList.add('hidden'); });

manageProjectBtn.addEventListener('click', () => projectModal.classList.remove('hidden'));
closeProjectModalBtn.addEventListener('click', () => projectModal.classList.add('hidden'));
projectModal.addEventListener('click', (e) => { if (e.target === projectModal) projectModal.classList.add('hidden'); });

// Initialize
const setDefaultDateFilters = () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDate = formatDate(firstDayOfMonth);
    const endDate = formatDate(lastDayOfMonth);
    filterDateStart.value = startDate;
    filterDateEnd.value = endDate;
    currentFilters.dateStart = startDate;
    currentFilters.dateEnd = endDate;
    if (filterDateStart.nextElementSibling) filterDateStart.nextElementSibling.style.display = 'none';
    filterDateStart.classList.add('text-gray-900');
    if (filterDateEnd.nextElementSibling) filterDateEnd.nextElementSibling.style.display = 'none';
    filterDateEnd.classList.add('text-gray-900');
};

const initializeCalendar = () => {
    calendar.current = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,listWeek' },
        events: [],
        height: 'auto',
        views: { dayGridMonth: { dayMaxEvents: true }, dayGridWeek: { dayMaxEvents: false } },
        viewDidMount: function (info) {
            if (info.view.type === 'dayGridWeek') {
                calendarEl.classList.add('week-view-active');
            } else {
                calendarEl.classList.remove('week-view-active');
            }
        },
        eventClick: function (info) {
            const taskId = info.event.extendedProps.task.id;
            openEditModal(taskId);
        },
        eventDidMount: function (info) {
            const task = info.event.extendedProps.task;
            if (!task) return;
            const promiseDiff = calculatePromiseDifference(task);
            tippy(info.el, {
                content: `<div class="text-left p-1"><p class="font-bold mb-1">${info.event.title}</p><p class="text-xs"><span class="font-semibold">Assigned:</span> ${task.assigned_date}</p><p class="text-xs"><span class="font-semibold">Promise:</span> ${task.promise_date}</p><p class="text-xs"><span class="font-semibold">Duration:</span> ${promiseDiff}</p></div>`,
                allowHTML: true,
                theme: 'light',
            });
        }
    });
    calendar.current.render();
};

setDefaultDateFilters();
fetchData();
initializeCalendar();
switchTab('list');
