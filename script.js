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

  function todayIso(){
    return new Date().toISOString().slice(0, 10);
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

    if(day === 0) return false;
    if(day === 6) return total >= 9 * 60 && total <= 17 * 60;
    return total >= 9 * 60 && total <= 19 * 60;
  }

  function hasConflict(date, time){
    return getAppointments().some((appointment)=>{
      const status = appointment.status || 'pending';
      return appointment.date === date && appointment.time === time && status !== 'cancelled';
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
          <strong>${service.name}</strong>
          <span>${duration}</span>
          <span>${formatPrice(service.price)}</span>
        `;
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

  function initBooking(){
    const form = qs('#booking-form');
    const dateInput = qs('#date');
    if(dateInput) dateInput.min = todayIso();
    if(!form) return;

    form.addEventListener('submit', (event)=>{
      event.preventDefault();
      const name = qs('#name')?.value.trim();
      const phone = qs('#phone')?.value.trim();
      const serviceId = qs('#service')?.value;
      const date = qs('#date')?.value;
      const time = qs('#time')?.value;
      const service = getService(serviceId);

      if(!name || !phone || !service || !date || !time){
        setStatus('Preencha todos os campos obrigatorios.', 'error');
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

      const message = [
        `Ola, quero confirmar meu agendamento na Roger's Barbearia.`,
        `Nome: ${name}`,
        `Telefone: ${phone}`,
        `Servico: ${service.name}`,
        `Data: ${date}`,
        `Horario: ${time}`
      ].join('\n');

      setStatus('Agendamento salvo. Abrindo WhatsApp para confirmacao.', 'success');
      window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setYears();
    renderServices();
    initBooking();
  });
})();
