frappe.ready(async () => {
	initialise_select_date();
	await generateServicesSelect();
});

async function initialise_select_date() {
	navigate_to_page(1);
	await get_global_variables();
	setup_date_picker();
	setup_timezone_selector();
	hide_next_button();
}

async function get_global_variables() {
	// Using await through this file instead of then.
	window.appointment_settings = (
		await frappe.call({
			method: "erpnext.www.book_appointment.index.get_appointment_settings",
		})
	).message;
	window.timezones = (
		await frappe.call({
			method: "erpnext.www.book_appointment.index.get_timezones",
		})
	).message;
}

function setup_timezone_selector() {
	let timezones_element = document.getElementById("appointment-timezone");
	let local_timezone = moment.tz.guess();
	window.timezones.forEach((timezone) => {
		let opt = document.createElement("option");
		opt.value = timezone;
		if (timezone == local_timezone) {
			opt.selected = true;
		}
		opt.innerHTML = timezone;
		timezones_element.appendChild(opt);
	});
}

function setup_date_picker() {
	let date_picker = document.getElementById("appointment-date");
	let today = new Date();
	date_picker.min = today.toISOString().substr(0, 10);
	today.setDate(today.getDate() + window.appointment_settings.advance_booking_days);
	date_picker.max = today.toISOString().substr(0, 10);
}

function hide_next_button() {
	let next_button = document.getElementById("next-button");
	next_button.disabled = true;
	next_button.onclick = () => frappe.msgprint(__("Please select a date and time"));
}

function show_next_button() {
	let next_button = document.getElementById("next-button");
	next_button.disabled = false;
	next_button.onclick = setup_details_page;
}

function on_date_or_timezone_select() {
	let date_picker = document.getElementById("appointment-date");
	let timezone = document.getElementById("appointment-timezone");
	if (date_picker.value === "") {
		clear_time_slots();
		hide_next_button();
		frappe.throw(__("Please select a date"));
	}
	window.selected_date = date_picker.value;
	window.selected_timezone = timezone.value;
	update_time_slots(date_picker.value, timezone.value);
	let lead_text = document.getElementById("lead-text");
	lead_text.innerHTML = __("Select Time");
}

async function get_time_slots(date, timezone) {
	let slots = (
		await frappe.call({
			method: "erpnext.www.book_appointment.index.get_appointment_slots",
			args: {
				date: date,
				timezone: timezone,
			},
		})
	).message;
	return slots;
}

// #region Added by Raul

async function get_services_appointment() {
	let services = [];
	await frappe.call({
		method: 'erpnext.www.book_appointment.index.get_services_appointment',
		args: {},
		callback: (r) => {
			services = r.message.length === 0 ? [{link_service: 'No hay servicios'}] : r.message;
		},
		error: (r) => {
			frappe.show_alert(__("Something went wrong please try again"));
		}
	})

	return services;
}

async function generateServicesSelect() {
	let services = await get_services_appointment();
	let select = document.getElementById('serviceSelect');
	services.forEach(function (service) {
		let opcion = document.createElement('option');
		opcion.value = service.link_service;
		opcion.textContent = service.link_service;
		select.appendChild(opcion);
	});
	select.selectedIndex = -1;
}

async function get_agents_appointment(service_code) {
	let agents = [];
	await frappe.call({
		method: 'erpnext.www.book_appointment.index.get_agents_service_appointment',
		args: {
			service_code
		},
		callback: (r) => {
			agents = r.message.length === 0 ? [{parent: 'No hay agentes'}] : r.message;
		},
		error: (r) => {
			frappe.show_alert(__("Something went wrong please try again"));
		}
	})

	return agents;
}

async function generateAgentsSelect(agents) {
	let select = document.getElementById('agentsSelect');
	select.innerHTML = '';
	agents.forEach(function (agent) {
		let opcion = document.createElement('option');
		opcion.value = agent.parent;
		opcion.textContent = agent.parent;
		select.appendChild(opcion);
	});
	select.selectedIndex = -1;

}

async function onChange_Service(){
	let selectValue = document.getElementById('serviceSelect').value;
	let agents = await get_agents_appointment(selectValue);
	window.available_agents = await get_available_agents();
	const agentes_disponibles = agents.filter(agent => !agenteOcupado(agent.parent))
	generateAgentsSelect(agentes_disponibles);	
}

function agenteOcupado(agente){
	const citas_Agente = window.available_agents.filter(cita => cita.booking_agent === agente)
	return citas_Agente.length > 0;
}

async function get_name_service(employee,service_code) {
	let name;
	await frappe.call({
		method: 'erpnext.www.book_appointment.index.get_name_service',
		args: {
			employee,
			service_code
		},
		callback: (r) => {
			name = r.message;
		},
		error: (r) => {
			frappe.show_alert(__("Something went wrong please try again"));
		}
	})
	return name;
}

async function onChange_Agent(){
	let employee = document.getElementById('agentsSelect').value;
	let service_code = document.getElementById('serviceSelect').value;
	window.nameService = await get_name_service(employee,service_code);
}

async function get_available_agents() {
	let scheduled_time = window.selected_date + " " +window.selected_time;
	let end_scheduled_time = moment(scheduled_time);
	end_scheduled_time = end_scheduled_time.add(window.appointment_settings.appointment_duration,'minutes').format('YYYY-MM-DD HH:mm:ss');
	window.end_scheduled_time = end_scheduled_time;
	let service = document.getElementById("serviceSelect").value;
	let agents = [];
	await frappe.call({
		method: 'erpnext.www.book_appointment.index.get_available_agents',
		args: {
			scheduled_time,
			service,
			end_scheduled_time
		},
		callback: (r) => {
			agents = r.message;
		},
		error: (r) => {
			frappe.show_alert(__("Something went wrong please try again"));
		}
	})
	return agents;
}

//#endregion 

async function update_time_slots(selected_date, selected_timezone) {
	let timeslot_container = document.getElementById("timeslot-container");
	window.slots = await get_time_slots(selected_date, selected_timezone);
	clear_time_slots();
	if (window.slots.length <= 0) {
		let message_div = document.createElement("p");
		message_div.innerHTML = __("There are no slots available on this date");
		message_div.style.textAlign ='center'
		timeslot_container.appendChild(message_div);
		return;
	}
	window.slots.forEach((slot, index) => {
		// Get and append timeslot div
		let timeslot_div = get_timeslot_div_layout(slot);
		timeslot_container.appendChild(timeslot_div);
	});
	set_default_timeslot();
}

function get_timeslot_div_layout(timeslot) {
	let start_time = new Date(timeslot.time);
	let timeslot_div = document.createElement("div");
	timeslot_div.classList.add("time-slot");
	if (!timeslot.availability) {
		timeslot_div.classList.add("unavailable");
	}
	timeslot_div.innerHTML = get_slot_layout(start_time);
	timeslot_div.id = timeslot.time.substring(11, 19);
	timeslot_div.addEventListener("click", select_time);
	return timeslot_div;
}

function clear_time_slots() {
	// Clear any existing divs in timeslot container
	let timeslot_container = document.getElementById("timeslot-container");
	while (timeslot_container.firstChild) {
		timeslot_container.removeChild(timeslot_container.firstChild);
	}
}

function get_slot_layout(time) {
	let timezone = document.getElementById("appointment-timezone").value;
	time = new Date(time);
	let start_time_string = moment(time).tz(timezone).format("LT");
	let end_time = moment(time).tz(timezone).add(window.appointment_settings.appointment_duration, "minutes");
	let end_time_string = end_time.format("LT");
	return `<span style="font-size: 1.2em;">${start_time_string} ${__(
		"to"
	)} ${end_time_string}</span>`;
}

function select_time() {
	if (this.classList.contains("unavailable")) {
		return;
	}
	let selected_element = document.getElementsByClassName("selected");
	if (!(selected_element.length > 0)) {
		this.classList.add("selected");
		show_next_button();
		return;
	}
	selected_element = selected_element[0];
	window.selected_time = this.id;
	selected_element.classList.remove("selected");
	this.classList.add("selected");
	show_next_button();
}

function set_default_timeslot() {
	let timeslots = document.getElementsByClassName("time-slot");
	// Can't use a forEach here since, we need to break the loop after a timeslot is selected
	for (let i = 0; i < timeslots.length; i++) {
		const timeslot = timeslots[i];
		if (!timeslot.classList.contains("unavailable")) {
			timeslot.classList.add("selected");
			break;
		}
	}
}

function navigate_to_page(page_number) {
	let page1 = document.getElementById("select-date-time");
	let page2 = document.getElementById("enter-details");
	switch (page_number) {
		case 1:
			page1.style.display = "block";
			page2.style.display = "none";
			break;
		case 2:
			page1.style.display = "none";
			page2.style.display = "block";
			break;
		default:
			break;
	}
}

function setup_details_page() {
	navigate_to_page(2);
	let date_container = document.getElementsByClassName("date-span")[0];
	let time_container = document.getElementsByClassName("time-span")[0];
	setup_search_params();
	date_container.innerHTML = moment(window.selected_date).format("MMM Do YYYY");
	time_container.innerHTML = moment(window.selected_time, "HH:mm:ss").format("LT");
}

function setup_search_params() {
	let search_params = new URLSearchParams(window.location.search);
	let customer_name = search_params.get("name");
	let customer_email = search_params.get("email");
	let detail = search_params.get("details");
	if (customer_name) {
		let name_input = document.getElementById("customer_name");
		name_input.value = customer_name;
		name_input.disabled = true;
	}
	if (customer_email) {
		let email_input = document.getElementById("customer_email");
		email_input.value = customer_email;
		email_input.disabled = true;
	}
	if (detail) {
		let detail_input = document.getElementById("customer_notes");
		detail_input.value = detail;
		detail_input.disabled = true;
	}
}
async function submit() {
	let button = document.getElementById("submit-button");
	// button.disabled = true;
	let form = document.querySelector("#customer-form");
	if (!form.checkValidity()) {
		form.reportValidity();
		// button.disabled = false;
		return;
	}
	let contact = get_form_data();
	let appointment = frappe.call({
		method: "erpnext.www.book_appointment.index.create_appointment",
		args: {
			date: window.selected_date,
			time: window.selected_time,
			contact: contact,
			tz: window.selected_timezone,
		},
		callback: (response) => {
			if (response.message.status == "Unverified") {
				frappe.show_alert(__("Please check your email to confirm the appointment"));
			} else {
				frappe.show_alert(__("Appointment Created Successfully"));
			}
			setTimeout(() => {
				let redirect_url = "/";
				if (window.appointment_settings.success_redirect_url) {
					redirect_url += window.appointment_settings.success_redirect_url;
				}
				window.location.href = redirect_url;
			}, 5000);
		},
		error: (err) => {
			frappe.show_alert(__("Something went wrong please try again"));
			// button.disabled = false;
		},
	});
}

function get_form_data() {
	let contact = {};
	let inputs = ["name", "skype", "number", "notes", "email"];
	inputs.forEach((id) => (contact[id] = document.getElementById(`customer_${id}`).value));
	contact["agent_services"] = window.nameService[0].name;
	contact["booking_agent"] = document.getElementById(`agentsSelect`).value;
	contact["end_scheduled_time"] = window.end_scheduled_time;
	return contact;
}

const dateDisplay = document.getElementById("dateDisplay");
const daysContainer = document.getElementById("daysContainer");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let currentDate = new Date();

function displayDates() {
	dateDisplay.innerText = currentDate.toLocaleDateString("es-ES", {
		// month: "long",
		year: "numeric"
	});

	daysContainer.innerHTML = "";

	let startOfWeek = getStartOfWeek(currentDate);

	for (let i = 0; i < 7; i++) {
		const dayContainer = document.createElement("div");
		dayContainer.classList.add("day-container");

		const monthLabel = document.createElement("div");
		monthLabel.classList.add("month-label");
		monthLabel.innerText = startOfWeek.toLocaleDateString("es-ES", {
			month: "long"
		});

		const dayCircle = document.createElement("div");
		dayCircle.classList.add("day-circle");
		dayCircle.innerText = startOfWeek.getDate();

		// if(startOfWeek.getDate() === 1){
		dayContainer.appendChild(monthLabel);
		// }

		const day = new Date(startOfWeek.getTime()); // Creamos una copia de startOfWeek
		day.setDate(day.getDate()); // Sumamos i al día de la copia
		dayCircle.addEventListener("click", () => {
			// handleDayClick(day.getDate());
			console.log("getDate():",day)
			let date_picker = document.getElementById("appointment-date");
			date_picker.value = day.toISOString().slice(0,10);
			on_date_or_timezone_select()
		});

		dayContainer.appendChild(dayCircle);
		daysContainer.appendChild(dayContainer);

		startOfWeek.setDate(startOfWeek.getDate() + 1); // Siguiente día
	}
}

function handleDayClick(day) {
	alert(`Hiciste clic en el día ${day}`);
}

function getStartOfWeek(date) {
	const startOfWeek = new Date(date);
	return startOfWeek;
}

prevBtn.addEventListener("click", () => {
	currentDate.setDate(currentDate.getDate() - 7); // Retrocede 7 días
	displayDates();
});

nextBtn.addEventListener("click", () => {
	currentDate.setDate(currentDate.getDate() + 7); // Avanza 7 días
	displayDates();
});

displayDates();