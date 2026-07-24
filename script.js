(function(){
  const WHATSAPP_NUMBER = '5511985712384';
  const SERVICES = [
    {id:'corte', name:'Corte Masculino/Infantil', duration:30, price:50},
    {id:'barba', name:'Barba Simples', duration:20, price:50},
    {id:'corte_barba', name:'Corte + Barba', duration:50, price:80},
    {id:'sobrancelha', name:'Sobrancelha', duration:10, price:15},
    {id:'bigode', name:'Bigode', duration:10, price:15},
    {id:'corte_mensal', name:'Corte mensal', period:'mensal', price:140},
    {id:'corte_mensal_barba', name:'Corte mensal + barba', period:'mensal', price:240}
  ];

  function qs(selector){return document.querySelector(selector)}

  function formatPrice(value){
    return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
  }

  function getAppointments(){
    try{return JSON.parse(localStorage.getItem('appointments') || '[]')}catch(e){return[]}
  }

  function saveAppointments(appointments){
    localStorage.setItem('appointments', JSON.stringify(appointments));
  }

  function getService(id){
    return SERVICES.find((service)=>service.id === id);
  }

  function isMonthlyService(service){
    return Boolean(service && service.period === 'mensal');
  }

  function setMonthlyNote(visible){
    const note = qs('#monthly-note');
    if(!note) return;
    note.classList.toggle('hidden', !visible);
  }

  function updateBookingTexts(serviceId){
    const service = getService(serviceId);
    const formDesc = qs('#form-desc');
    const dateLabel = document.querySelector('label[for="date"]');
    const timeLabel = document.querySelector('label[for="time"]');

    if(!dateLabel || !timeLabel || !formDesc) return;

    if(isMonthlyService(service)){
      formDesc.textContent = 'Escolha o dia da semana e o horário para seu serviço mensal. Em seguida, vamos confirmar via WhatsApp.';
      dateLabel.textContent = 'Data *';
      timeLabel.textContent = 'Horário *';
      setMonthlyNote(true);
    } else {
      formDesc.textContent = 'Preencha os campos abaixo para agendar. Campos com * são obrigatórios.';
      dateLabel.textContent = 'Data *';
      timeLabel.textContent = 'Horário *';
      setMonthlyNote(false);
    }
  }

  function todayIso(){
    return new Date().toISOString().slice(0, 10);
  }

  function getBusinessSettings(){
    try { return JSON.parse(localStorage.getItem('business-settings') || '{}'); } catch (e) { return {}; }
  }

  function weekdayLabel(day){
    return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][day] || '';
  }

  function is16to18Allowed(){
    return Boolean(getBusinessSettings().allow16to18);
  }

  function getBusinessSlots(date){
    const day = new Date(`${date}T12:00:00`).getDay();
    const allow = is16to18Allowed();
    if(day === 0) return [];

    const endHour = day === 6 ? 17 : 19;
    const slots = [];

    for(let hour = 9; hour < endHour; hour++){
      for(const minute of [0, 30]){
        const total = hour * 60 + minute;
        if(!allow && total >= 16 * 60 && total < 18 * 60) continue;
        if(day === 6 && total >= 17 * 60) continue;
        slots.push(`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
      }
    }

    return slots;
  }

  function getSlotOptions(date){
    return getBusinessSlots(date || todayIso());
  }

  function populateTimeOptions(date){
    const timeSelect = qs('#time');
    if(!timeSelect) return;
    const slots = getSlotOptions(date).filter((slot)=>!hasConflict(date, slot));
    timeSelect.innerHTML = '<option value="">— Selecione um horário —</option>';
    slots.forEach((slot)=>{
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = slot;
      timeSelect.appendChild(option);
    });
  }

  function refreshAvailability(date){
    const selectedDate = date || qs('#date')?.value;
    renderAvailability(selectedDate);
    populateTimeOptions(selectedDate);
  }

  function isPastDate(date){
    return date < todayIso();
  }

  function isSunday(date){
    return new Date(`${date}T12:00:00`).getDay() === 0;
  }

  function isWithinBusinessHours(date, time){
    const day = new Date(`${date}T12:00:00`).getDay();
    const [hour, minute] = time.split(':').map(Number);
    const total = hour * 60 + minute;
    const allow = is16to18Allowed();

    if(day === 0) return false;
    if(day === 6){
      if(!allow && total >= 16 * 60 && total < 17 * 60) return false;
      return total >= 9 * 60 && total < 17 * 60;
    }

    if(!allow && total >= 16 * 60 && total < 18 * 60) return false;
    return total >= 9 * 60 && total < 19 * 60;
  }

  function updateShopStatus(){
    const statusChip = qs('#shop-status');
    if(!statusChip) return;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const day = now.getDay();
    const closing = day === 0 ? null : (day === 6 ? '17:00' : '19:00');
    const opening = day === 0 ? '09:00' : '09:00';
    const open = closing && isWithinBusinessHours(today, currentTime);

    statusChip.classList.toggle('open', open);
    statusChip.classList.toggle('closed', !open);

    if(open){
      statusChip.textContent = `Aberto · Fecha ${closing}`;
    } else if(day === 0){
      statusChip.textContent = 'Fechado · Reabre segunda às 09:00';
    } else if(currentTime < opening){
      statusChip.textContent = `Fechado · Abre às ${opening}`;
    } else if(day === 6){
      statusChip.textContent = 'Fechado · Reabre segunda às 09:00';
    } else {
      statusChip.textContent = `Fechado · Reabre amanhã às 09:00`;
    }
  }

  function hasConflict(date, time){
    return getAppointments().some((appointment)=>{
      const status = appointment.status || 'pending';
      return appointment.date === date && appointment.time === time && status !== 'cancelled';
    });
  }

  function renderAvailability(date){
    const container = qs('#availability-list');
    if(!container) return;

    const selectedDate = date || qs('#date')?.value;
    if(!selectedDate){
      container.innerHTML = '<p class="availability-item">Selecione uma data para ver a disponibilidade.</p>';
      return;
    }

    const dateObj = new Date(`${selectedDate}T12:00:00`);
    const weekday = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][dateObj.getDay()];
    const title = document.createElement('div');
    title.className = 'availability-item';
    title.innerHTML = `<strong>Dia selecionado: ${weekday} - ${selectedDate}</strong>`;
    container.innerHTML = '';
    container.appendChild(title);

    const slots = getSlotOptions(selectedDate);
    if(!slots.length){
      container.innerHTML += '<p class="availability-item">Sem horários disponíveis para esta data.</p>';
      return;
    }

    slots.forEach((time)=>{
      const item = document.createElement('div');
      item.className = `availability-item ${hasConflict(selectedDate, time) ? 'occupied' : 'free'}`;
      const label = document.createElement('span');
      label.textContent = time;
      const status = document.createElement('small');
      status.textContent = hasConflict(selectedDate, time) ? 'Ocupado' : 'Livre';
      item.appendChild(label);
      item.appendChild(status);
      container.appendChild(item);
    });
  }

  function renderServices(){
    const list = qs('#services-list');
    const select = qs('#service');

    if(list){
      list.innerHTML = '';
      SERVICES.forEach((service)=>{
        const item = document.createElement('li');
        item.className = 'service-card';
        const duration = service.period ? service.period : `${service.duration} min`;
        item.innerHTML = `
          <a class="service-link" href="agendar.html?service=${service.id}" aria-label="Agendar ${service.name}">
            <strong>${service.name}</strong>
            <span>${duration}</span>
            <span>${formatPrice(service.price)}</span>
          </a>
        `;
        item.addEventListener('mouseenter', ()=>item.classList.add('is-active'));
        item.addEventListener('mouseleave', ()=>item.classList.remove('is-active'));
        item.addEventListener('touchstart', ()=>item.classList.add('is-active'));
        item.addEventListener('touchend', ()=>item.classList.remove('is-active'));
        list.appendChild(item);
      });
    }

    if(select){
      SERVICES.forEach((service)=>{
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = `${service.name} - ${formatPrice(service.price)}`;
        select.appendChild(option);
      });

      select.addEventListener('change', ()=>{
        updateBookingTexts(select.value);
      });
    }
  }

  function setYears(){
    ['#year', '#year-agendar'].forEach((selector)=>{
      const target = qs(selector);
      if(target) target.textContent = new Date().getFullYear();
    });
  }

  function setStatus(message, type){
    const status = qs('#status');
    if(!status) return;
    status.textContent = message;
    status.className = `status ${type || ''}`.trim();
  }

  function prefillServiceFromUrl(){
    const select = qs('#service');
    if(!select) return;

    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get('service');
    if(!serviceId) return;

    const option = Array.from(select.options).find((item)=>item.value === serviceId);
    if(option){
      select.value = serviceId;
      const form = qs('#booking-form');
      if(form){
        form.scrollIntoView({behavior:'smooth', block:'start'});
      }
    }
  }

  function initBooking(){
    const form = qs('#booking-form');
    const dateInput = qs('#date');
    const weekdayField = qs('#weekday-field');
    const weekdaySelect = qs('#weekday');
    if(dateInput) dateInput.min = todayIso();
    populateTimeOptions();
    if(!form) return;

    form.addEventListener('submit', (event)=>{
      event.preventDefault();
      const name = qs('#name')?.value.trim();
      const phone = qs('#phone')?.value.trim();
      const serviceId = qs('#service')?.value;
      const date = qs('#date')?.value;
      const time = qs('#time')?.value;
      const service = getService(serviceId);

      if(!name || !phone || !service){
        setStatus('Preencha todos os campos obrigatorios.', 'error');
        return;
      }

      if(isMonthlyService(service)){
        if(weekdaySelect){
          const weekdayValue = weekdaySelect.value;
          if(!weekdayValue){
            setStatus('Escolha o dia da semana para seu serviço.', 'error');
            return;
          }
        }

        const message = [
          `Ola, quero fechar minha assinatura mensal na Roger's Barbearia.`,
          `Nome: ${name}`,
          `Telefone: ${phone}`,
          `Servico: ${service.name}`,
          weekdaySelect ? `Dia da semana: ${weekdayLabel(Number(weekdaySelect.value))}` : '',
          `Atenção, planos mensais têm direito a serviços ilimitados no mês. Em caso de alteração de agendamentos, verificar disponibilidade por WhatsApp.`
        ].filter(Boolean).join('\n');

        setStatus('Redirecionando para o WhatsApp para fechar sua assinatura.', 'success');
        window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        return;
      }

      if(!date || !time){
        setStatus('Selecione uma data e um horario para este servico.', 'error');
        return;
      }

      if(isPastDate(date)){
        setStatus('Escolha uma data atual ou futura.', 'error');
        return;
      }

      if(isSunday(date)){
        setStatus('A barbearia nao atende aos domingos.', 'error');
        return;
      }

      if(!isWithinBusinessHours(date, time)){
        setStatus('Escolha um horario dentro do funcionamento.', 'error');
        return;
      }

      if(hasConflict(date, time)){
        setStatus('Esse horario ja esta ocupado.', 'error');
        return;
      }

      const appointment = {
        id: Date.now(),
        name,
        phone,
        service: service.id,
        date,
        time,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      const appointments = getAppointments();
      appointments.push(appointment);
      saveAppointments(appointments);
      refreshAvailability(date);

      const message = [
        `Ola, quero confirmar meu agendamento na Roger's Barbearia.`,
        `Nome: ${name}`,
        `Telefone: ${phone}`,
        `Servico: ${service.name}`,
        `Data: ${date}`,
        `Horario: ${time}`
      ].join('\n');

      setStatus('Agendamento salvo. O barbeiro poderá confirmar no admin.', 'success');
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setYears();
    renderServices();
    prefillServiceFromUrl();
    initBooking();
    updateShopStatus();
    setInterval(updateShopStatus, 60 * 1000);

    const dateInput = qs('#date');
    const serviceSelect = qs('#service');
    const dateField = qs('#date-field');
    const weekdayField = qs('#weekday-field');
    const weekdaySelect = qs('#weekday');

    if(dateInput){
      dateInput.addEventListener('change', ()=>refreshAvailability(dateInput.value));
      dateInput.addEventListener('input', ()=>refreshAvailability(dateInput.value));
      refreshAvailability(dateInput.value);
    }

    if(serviceSelect){
      serviceSelect.addEventListener('change', ()=>{
        updateBookingTexts(serviceSelect.value);
        const monthly = isMonthlyService(getService(serviceSelect.value));
        if(weekdayField){
          weekdayField.classList.toggle('hidden', !monthly);
        }
        if(dateField){
          dateField.classList.toggle('hidden', monthly);
        }
        setMonthlyNote(monthly);

        if(monthly){
          qs('#date').removeAttribute('required');
        } else {
          qs('#date').setAttribute('required', 'true');
        }
      });
      updateBookingTexts(serviceSelect.value);
    }

    if(weekdayField){
      const monthly = isMonthlyService(getService(serviceSelect?.value));
      weekdayField.classList.toggle('hidden', !monthly);
      if(dateField){
        dateField.classList.toggle('hidden', monthly);
      }
      setMonthlyNote(monthly);
    }

    window.addEventListener('storage', ()=>refreshAvailability(qs('#date')?.value));
  });
})();
