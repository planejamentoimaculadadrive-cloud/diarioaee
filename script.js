// ================================================
// CONFIGURAÇÃO GOOGLE SHEETS
// Cole sua URL do Apps Script aqui após publicar
// ================================================
var SHEETS_URL = localStorage.getItem('aee_sheets_url') || 'https://script.google.com/macros/s/AKfycbzKNzABuqbqRBl0VPYyFzaH_sAANSB-DnUPQUZ76oxa3YwE-zynvL9nybTAKe5tl_R1/exec';

var ABAS = {
  escola:      'Escolas',
  gestor:      'Gestores',
  coordenador: 'Coordenadores',
  professor:   'Professores',
  turma:       'Turmas',
  aluno:       'Alunos',
  'reg-aluno': 'Registros por Aluno',
  sessao:      'Sessões',
  frequencia:  'Frequência',
  desempenho:  'Desempenho'
};

// ================================================
// BANCO DE DADOS LOCAL
// ================================================
var DB = {
  escola:[],gestor:[],coordenador:[],professor:[],turma:[],aluno:[],
  'reg-aluno':[],sessao:[],frequencia:[],desempenho:[]
};
var editIdx = {
  escola:-1,gestor:-1,coordenador:-1,professor:-1,turma:-1,aluno:-1,
  'reg-aluno':-1,sessao:-1,frequencia:-1,desempenho:-1
};
var currentUser = null;

// ================================================
// FILTRO DE ALUNOS POR PROFESSOR
// ================================================
function getAlunosFiltrados(){
  if(!currentUser) return [];
  if(currentUser.role === 'professor'){
    var minhasTurmas = DB.turma
      .filter(function(t){ return t.professor === currentUser.nome; })
      .map(function(t){ return t.nome; });
    return DB.aluno.filter(function(a){
      return minhasTurmas.indexOf(a.turma) >= 0 || a.professor === currentUser.nome;
    });
  }
  // Se for gestor ou coordenador, filtra alunos da sua escola
  if(currentUser.role === 'gestor' || currentUser.role === 'coordenador'){
    return DB.aluno.filter(function(a){
      return a.escola === currentUser.escola;
    });
  }
  return DB.aluno; // Admin vê todos
}

// ================================================
// LOGIN
// ================================================
function doLogin(){
  var u = document.getElementById('li-user').value.trim();
  var p = document.getElementById('li-pass').value.trim();
  var err = document.getElementById('li-err');
  err.style.display = 'none';

  // Admin fixo — entra direto
  if(u === 'admin' && p === 'admin'){
    currentUser = {nome:'Administrador', role:'admin', user:'admin'};
    entrarApp(); return;
  }

  // Se DB ainda vazio, tenta carregar do Sheets primeiro
  var totalRegistros = DB.gestor.length + DB.coordenador.length + DB.professor.length;
  if(totalRegistros === 0 && SHEETS_URL){
    // Mostra mensagem de aguarde
    err.style.display = 'block';
    err.style.color = '#856404';
    err.textContent = '⏳ Carregando usuários, aguarde...';

    var keyMap = {
      gestor:      ['nome','cpf','escola','cargo','tel','email','formacao','inicio','obs','user','pass'],
      coordenador: ['nome','cpf','escola','area','turno','tel','email','formacao','obs','user','pass'],
      professor:   ['nome','cpf','escola','esp','turno','vinculo','reg','tel','email','formacao','obs','user','pass']
    };
    var tiposLogin = ['gestor','coordenador','professor'];
    var carregados = 0;

    tiposLogin.forEach(function(tipo){
      var nomeAba = ABAS[tipo];
      fetch(SHEETS_URL + '?aba=' + encodeURIComponent(nomeAba))
        .then(function(r){ return r.json(); })
        .then(function(res){
          if(res.status==='ok' && res.dados && res.dados.length > 1){
            var linhas = res.dados.slice(1);
            var keys = keyMap[tipo];
            DB[tipo] = linhas.map(function(linha){
              var obj = {};
              keys.forEach(function(k,i){ obj[k] = linha[i] || ''; });
              return obj;
            });
          }
          carregados++;
          if(carregados === tiposLogin.length){
            // Tenta logar novamente após carregar os dados
            doLoginAttempt(u, p, err);
          }
        })
        .catch(function(){
          carregados++;
          if(carregados === tiposLogin.length){
            doLoginAttempt(u, p, err);
          }
        });
    });
  } else {
    doLoginAttempt(u, p, err);
  }
}

function doLoginAttempt(u, p, err){
  function igual(a,b){
    if(!a||!b) return false;
    return String(a).trim() === String(b).trim();
  }

  for(var i=0;i<DB.gestor.length;i++){
    var g=DB.gestor[i];
    if(igual(g.user,u) && igual(g.pass,p)){
      currentUser={nome:g.nome,role:'gestor',user:u, escola: g.escola};
      entrarApp(); return;
    }
  }
  for(var i=0;i<DB.coordenador.length;i++){
    var c=DB.coordenador[i];
    if(igual(c.user,u) && igual(c.pass,p)){
      currentUser={nome:c.nome,role:'coordenador',user:u, escola: c.escola};
      entrarApp(); return;
    }
  }
  for(var i=0;i<DB.professor.length;i++){
    var pr=DB.professor[i];
    if(igual(pr.user,u) && igual(pr.pass,p)){
      currentUser={nome:pr.nome,role:'professor',user:u, escola: pr.escola};
      entrarApp(); return;
    }
  }

  // Debug no console
  console.log('=== DIAGNÓSTICO LOGIN ===');
  console.log('Digitado — user:', u, '| pass:', p);
  console.log('Gestores:', DB.gestor.map(function(x){return {user:x.user,pass:x.pass};}));
  console.log('Coordenadores:', DB.coordenador.map(function(x){return {user:x.user,pass:x.pass};}));
  console.log('Professores:', DB.professor.map(function(x){return {user:x.user,pass:x.pass};}));

  err.style.display='block';
  err.textContent = '⚠ Usuário ou senha incorretos.';
}

function entrarApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('sb-name').textContent = currentUser.nome;
  var roles={admin:'Administrador',gestor:'Gestor Escolar',coordenador:'Coordenador',professor:'Professor'};
  document.getElementById('sb-role').textContent = roles[currentUser.role] || currentUser.role;

  // Controle de visibilidade do menu de cadastros
  var navCad = document.getElementById('nav-cad');
  if(currentUser.role === 'admin' || currentUser.role === 'gestor' || currentUser.role === 'coordenador'){
    navCad.style.display = 'block';
    // Esconder itens específicos para gestores/coordenadores
    if(currentUser.role === 'gestor' || currentUser.role === 'coordenador'){
      document.querySelector('.ni[onclick="showPage(\'escola\')"]').style.display = 'none';
      document.querySelector('.ni[onclick="showPage(\'gestor\')"]').style.display = 'none';
      document.querySelector('.ni[onclick="showPage(\'coordenador\')"]').style.display = 'none';
    } else { // Admin vê tudo
      document.querySelector('.ni[onclick="showPage(\'escola\')"]').style.display = 'flex';
      document.querySelector('.ni[onclick="showPage(\'gestor\')"]').style.display = 'flex';
      document.querySelector('.ni[onclick="showPage(\'coordenador\')"]').style.display = 'flex';
    }
  } else {
    navCad.style.display = 'none';
  }

  // Controle de acesso à página de configurações do Google Sheets
  var navConfig = document.querySelector('.ni[onclick="showPage(\'configuracoes\')"]');
  if(currentUser.role === 'admin'){
    navConfig.style.display = 'flex'; // ou 'block' dependendo do seu CSS
  } else {
    navConfig.style.display = 'none';
  }

  // Carrega URL salva no campo de configuração
  var cfgUrl = document.getElementById('cfg-url');
  if(cfgUrl && SHEETS_URL) cfgUrl.value = SHEETS_URL;
  atualizarDashboard();
  // Tenta carregar dados da planilha ao entrar
  if(SHEETS_URL) carregarDoSheets();
}

function doLogout(){
  currentUser = null;
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('li-user').value='';
  document.getElementById('li-pass').value='';
  document.getElementById('li-err').style.display='none';
}

// ================================================
// CONFIGURAÇÃO GOOGLE SHEETS
// ================================================
function salvarConfigUrl(){
  if(currentUser.role !== 'admin'){
    toast('Apenas administradores podem alterar a URL do Google Sheets.','terr');
    document.getElementById('cfg-url').value = SHEETS_URL; // Reverte para o valor anterior
    return;
  }
  var url = document.getElementById('cfg-url').value.trim();
  SHEETS_URL = url;
  localStorage.setItem('aee_sheets_url', url);
  var st = document.getElementById('cfg-status');
  if(url){
    st.textContent = '✅ URL salva. Clique em "Testar Conexão" para verificar.';
    st.style.color = '#0f9d58';
  } else {
    st.textContent = '⬆ Cole a URL acima para ativar a integração.';
    st.style.color = 'var(--mu)';
  }
}

function testarConexao(){
  if(currentUser.role !== 'admin'){
    toast('Apenas administradores podem testar a conexão com o Google Sheets.','terr');
    return;
  }
  if(!SHEETS_URL){
    toast('Cole a URL do Apps Script primeiro! (Menu ⚙️ Google Sheets)','terr'); return;
  }
  var st = document.getElementById('cfg-status');
  st.textContent = '⏳ Testando conexão...';
  st.style.color = 'var(--p)';
  fetch(SHEETS_URL + '?aba=' + encodeURIComponent(ABAS.escola)) // Usar uma aba existente para teste
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(res.status==='ok'){
        st.textContent = '✅ Conexão estabelecida com sucesso! Planilha conectada.';
        st.style.color = '#0f9d58';
        toast('✅ Conexão com Google Sheets OK!','tok');
      } else {
        st.textContent = '❌ Erro: ' + (res.mensagem||'Resposta inesperada.');
        st.style.color = 'var(--r)';
      }
    })
    .catch(function(e){
      st.textContent = '❌ Falha na conexão. Verifique a URL e as permissões.';
      st.style.color = 'var(--r)';
      toast('Erro de conexão: ' + e,'terr');
    });
}

// ================================================
// ENVIAR DADOS PARA O GOOGLE SHEETS
// ================================================
function montarLinha(type, obj){
  var ordens = {
    escola:      ['nome','cnpj','rede','etapa','tel','email','end','obs'],
    gestor:      ['nome','cpf','escola','cargo','tel','email','formacao','inicio','obs','user','pass'],
    coordenador: ['nome','cpf','escola','area','turno','tel','email','formacao','obs','user','pass'],
    professor:   ['nome','cpf','escola','esp','turno','vinculo','reg','tel','email','formacao','obs','user','pass'],
    turma:       ['nome','escola','turno','professor','ano','obs'],
    aluno:       ['nome','nasc','sexo','escola','turma','turno','nee','cid','resp','tel','remail','professor','laudo','adapt','obs'],
    'reg-aluno': ['aluno','data','tipo','area','ativ','evol','obs'],
    sessao:      ['data','hora','professor','local','tema','alunos','ativ','rec','obs'],
    frequencia:  ['data','turma','aluno','status','justificativa'],
    desempenho:  ['data','aluno','area','nivel','obs','rec']
  };
  var keys = ordens[type] || [];
  return keys.map(function(k){ return obj[k] || ''; });
}

function enviarParaSheets(type){
  if(currentUser.role !== 'admin'){
    toast('Apenas administradores podem enviar dados para o Google Sheets.','terr');
    return;
  }
  if(!SHEETS_URL){
    toast('Configure a URL do Apps Script primeiro! (Menu ⚙️ Google Sheets)','terr');
    return;
  }
  var dados = DB[type] || [];
  if(dados.length === 0){
    toast('Nenhum registro para enviar!','tinf'); return;
  }
  toast('⏳ Enviando para a planilha...','tinf');

  // Envia todos os registros da aba
  var payload = {
    aba: ABAS[type],
    acao: 'limparEReescrever', // Usar limparEReescrever para garantir que a planilha reflita o estado local
    linhas: dados.map(function(obj){ return montarLinha(type, obj); }),
    usuario: currentUser ? currentUser.nome : 'Sistema'
  };

  fetch(SHEETS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  })
  .then(function(){
    toast('✅ ' + dados.length + ' registro(s) enviado(s) para a planilha!','tok');
  })
  .catch(function(e){
    toast('Erro ao enviar: ' + e,'terr');
  });
}

function sincronizarTudo(){
  if(currentUser.role !== 'admin'){
    toast('Apenas administradores podem sincronizar todos os dados.','terr');
    return;
  }
  if(!SHEETS_URL){
    toast('Configure a URL do Apps Script primeiro!','terr'); return;
  }
  var tipos = Object.keys(ABAS);
  var total = 0;
  var promises = [];

  tipos.forEach(function(t){
    if(DB[t] && DB[t].length > 0){
      var payload = {
        aba: ABAS[t],
        acao: 'limparEReescrever',
        linhas: DB[t].map(function(obj){ return montarLinha(t, obj); }),
        usuario: currentUser ? currentUser.nome : 'Sistema'
      };
      promises.push(fetch(SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      }));
      total += DB[t].length;
    }
  });

  if(total === 0){
    toast('Nenhum dado local para sincronizar.','tinf');
  } else {
    toast('🔄 Sincronizando ' + total + ' registros...','tinf');
    Promise.all(promises)
      .then(function(){
        toast('✅ Todos os dados sincronizados com a planilha!','tok');
      })
      .catch(function(e){
        toast('Erro ao sincronizar todos os dados: ' + e,'terr');
      });
  }
}

// ================================================
// CARREGAR DADOS DO GOOGLE SHEETS
// ================================================
function carregarDoSheets(){
  if(!SHEETS_URL) return;
  var keyMap = {
    escola:      ['nome','cnpj','rede','etapa','tel','email','end','obs'],
    gestor:      ['nome','cpf','escola','cargo','tel','email','formacao','inicio','obs','user','pass'],
    coordenador: ['nome','cpf','escola','area','turno','tel','email','formacao','obs','user','pass'],
    professor:   ['nome','cpf','escola','esp','turno','vinculo','reg','tel','email','formacao','obs','user','pass'],
    turma:       ['nome','escola','turno','professor','ano','obs'],
    aluno:       ['nome','nasc','sexo','escola','turma','turno','nee','cid','resp','tel','remail','professor','laudo','adapt','obs'],
    'reg-aluno': ['aluno','data','tipo','area','ativ','evol','obs'],
    sessao:      ['data','hora','professor','local','tema','alunos','ativ','rec','obs'],
    frequencia:  ['data','turma','aluno','status','justificativa'],
    desempenho:  ['data','aluno','area','nivel','obs','rec']
  };

  toast('⏳ Carregando dados da planilha...','tinf');

  var tipos = Object.keys(ABAS);
  var carregados = 0;

  tipos.forEach(function(tipo){
    fetch(SHEETS_URL + '?aba=' + encodeURIComponent(ABAS[tipo]))
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(res.status==='ok' && res.dados && res.dados.length > 1){
          var linhas = res.dados.slice(1); // pula cabeçalho
          var keys = keyMap[tipo] || [];
          DB[tipo] = linhas.map(function(linha){
            var obj = {};
            keys.forEach(function(k,i){ obj[k] = linha[i] || ''; });
            return obj;
          });
          // Não renderiza a tabela de frequência aqui para que só apareça ao buscar
          if (tipo !== 'frequencia') {
            renderTabela(tipo);
          }
        }
        carregados++;
        if(carregados === tipos.length){
          popularSelects();
          atualizarDashboard();
          toast('✅ Dados carregados da planilha!','tok');
        }
      })
      .catch(function(e){
        console.error('Erro ao carregar dados da aba ' + tipo + ':', e);
        carregados++;
        if(carregados === tipos.length){
          popularSelects();
          atualizarDashboard();
          toast('⚠️ Erro ao carregar alguns dados da planilha.','terr');
        }
      });
  });
}

// ================================================
// NAVEGAÇÃO
// ================================================
function showPage(id){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.ni').forEach(function(n){ n.classList.remove('active'); });
  var pg = document.getElementById('page-'+id);
  if(pg) pg.classList.add('active');
  document.querySelectorAll('.ni').forEach(function(n){
    if(n.getAttribute('onclick') && n.getAttribute('onclick').indexOf("'"+id+"'")>=0)
      n.classList.add('active');
  });
  if(id==='dashboard') atualizarDashboard();
  popularSelects();
  if(id==='frequencia') {
    popularFreqTurma();
    // Limpa a tabela de frequência ao entrar na página
    document.getElementById('tb-frequencia').innerHTML = '<tr class="erow"><td colspan="6">Nenhum registro cadastrado.</td></tr>';
    document.getElementById('cnt-frequencia').textContent = '0';
    document.getElementById('filter-fre-data').value = '';
    document.getElementById('filter-fre-turma').value = '';
  }
}

// ================================================
// POPULAR SELECTS DINAMICAMENTE
// ================================================
function popularSelects(){
  // Selects de Escola
  ['ges-escola','coo-escola','pro-escola','tur-escola','alu-escola'].forEach(function(sid){
    var el=document.getElementById(sid); if(!el) return;
    var v=el.value;
    el.innerHTML='<option value="">Selecione...</option>';
    // Gestores/Coordenadores só podem ver/selecionar sua própria escola
    var escolasDisponiveis = (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')) ?
                             DB.escola.filter(e => e.nome === currentUser.escola) : DB.escola;
    escolasDisponiveis.forEach(function(e){
      var op=document.createElement('option');
      op.value=e.nome; op.textContent=e.nome; el.appendChild(op);
    });
    el.value=v;
  });

  // Selects de Professor
  ['tur-professor','ses-professor'].forEach(function(sid){
    var el=document.getElementById(sid); if(!el) return;
    var v=el.value;
    el.innerHTML='<option value="">Selecione...</option>';
    // Gestores/Coordenadores só podem ver/selecionar professores da sua escola
    var professoresDisponiveis = (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')) ?
                                 DB.professor.filter(p => p.escola === currentUser.escola) : DB.professor;
    professoresDisponiveis.forEach(function(p){
      var op=document.createElement('option');
      op.value=p.nome; op.textContent=p.nome; el.appendChild(op);
    });
    el.value=v;
  });

  // Select de Aluno (filtrados por professor ou escola)
  var alunosFiltrados = getAlunosFiltrados();
  ['ra-aluno','des-aluno'].forEach(function(sid){
    var el=document.getElementById(sid); if(!el) return;
    var v=el.value;
    el.innerHTML='<option value="">Selecione...</option>';
    alunosFiltrados.forEach(function(a){
      var op=document.createElement('option');
      op.value=a.nome; op.textContent=a.nome; el.appendChild(op);
    });
    el.value=v;
  });

  // Select de Alunos Participantes (sessao)
  var sesAlu=document.getElementById('ses-alunos');
  if(sesAlu){
    var vs=Array.from(sesAlu.selectedOptions).map(function(o){return o.value;});
    sesAlu.innerHTML='';
    alunosFiltrados.forEach(function(a){
      var op=document.createElement('option');
      op.value=a.nome; op.textContent=a.nome;
      if(vs.indexOf(a.nome)>=0) op.selected=true;
      sesAlu.appendChild(op);
    });
  }

  // Select de Turma (filtrado por escola para gestores/coordenadores)
  var aluTur=document.getElementById('alu-turma');
  if(aluTur){
    var v=aluTur.value;
    aluTur.innerHTML='<option value="">Selecione...</option>';
    var turmasDisponiveis = (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')) ?
                            DB.turma.filter(t => t.escola === currentUser.escola) : DB.turma;
    turmasDisponiveis.forEach(function(t){
      var op=document.createElement('option');
      op.value=t.nome; op.textContent=t.nome; aluTur.appendChild(op);
    });
    aluTur.value=v;
  }

  // Select de Professor AEE Responsável (filtrado por escola para gestores/coordenadores)
  var aluPro=document.getElementById('alu-professor');
  if(aluPro){
    var v=aluPro.value;
    aluPro.innerHTML='<option value="">Selecione...</option>';
    var profsAEE = (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')) ?
                   DB.professor.filter(p => p.escola === currentUser.escola) : DB.professor;
    profsAEE.forEach(function(p){
      var op=document.createElement('option');
      op.value=p.nome; op.textContent=p.nome; aluPro.appendChild(op);
    });
    aluPro.value=v;
  }
}

function popularFreqTurma(){
  var el=document.getElementById('fre-turma'); if(!el) return;
  var v=el.value;
  el.innerHTML='<option value="">Selecione a turma...</option>';
  var turmasFiltradas = DB.turma;
  if(currentUser && currentUser.role==='professor'){
    turmasFiltradas = DB.turma.filter(function(t){
      return t.professor === currentUser.nome;
    });
  } else if (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    turmasFiltradas = DB.turma.filter(function(t){
      return t.escola === currentUser.escola;
    });
  }
  turmasFiltradas.forEach(function(t){
    var op=document.createElement('option');
    op.value=t.nome; op.textContent=t.nome; el.appendChild(op);
  });
  el.value=v;
}

function carregarAlunosTurma(){
  var turma=document.getElementById('fre-turma').value;
  var lista=document.getElementById('fre-lista');
  if(!turma){
    lista.innerHTML='<div style="text-align:center;color:var(--mu);padding:20px;font-style:italic">👆 Selecione uma turma para carregar os alunos.</div>';
    return;
  }
  var alunosFiltrados = getAlunosFiltrados();
  var alunos = alunosFiltrados.filter(function(a){ return a.turma===turma; });
  if(alunos.length===0){
    lista.innerHTML='<div style="text-align:center;color:var(--mu);padding:20px;font-style:italic">Nenhum aluno vinculado a esta turma.</div>';
    return;
  }
  var html='';
  alunos.forEach(function(a){
    html+='<div class="fi">';
    html+='<span class="fn">'+esc(a.nome)+'</span>';
    html+='<select name="freq_'+esc(a.nome)+'">';
    html+='<option value="Presente">✅ Presente</option>';
    html+='<option value="Falta">❌ Falta</option>';
    html+='<option value="Não tem atendimento no dia de hoje">⚠️ Não tem atendimento no dia de hoje</option>';
    html+='<option value="Justificado">📝 Justificado</option>';
    html+='</select>';
    // AQUI É A MUDANÇA: de input para select
    html+='<select name="just_'+esc(a.nome)+'">';
    html+='<option value="">Selecione a Justificativa</option>';
    html+='<option value="Atendimento Domiciliar (AD)">Atendimento Domiciliar (AD)</option>';
    html+='<option value="Atestado Médico (AM)">Atestado Médico (AM)</option>';
    html+='<option value="Casos Omisso (CO)">Casos Omisso (CO)</option>';
    html+='<option value="Declaração de Comparecimento à consulta medica (DC)">Declaração de Comparecimento à consulta medica (DC)</option>';
    html+='<option value="Declaração dos Pais ou Responsáveis (DP)">Declaração dos Pais ou Responsáveis (DP)</option>';
    html+='<option value="Estudante Atleta (EA)">Estudante Atleta (EA)</option>';
    html+='<option value="Estudante não tem atendimento no dia de hoje (EADH)">Estudante não tem atendimento no dia de hoje (EADH)</option>';
    html+='<option value="Estudante Gestante (EG)">Estudante Gestante (EG)</option>';
    html+='<option value="Estudante Trabalhador (ET)">Estudante Trabalhador (ET)</option>';
    html+='<option value="Falta de Transporte Escolar (FTE)">Falta de Transporte Escolar (FTE)</option>';
    html+='<option value="Pandemia (PAND)">Pandemia (PAND)</option>';
    html+='<option value="Outros">Outros</option>';
    html+='</select>';
    html+='</div>';
  });
  lista.innerHTML=html;
}

// ================================================
// CAMPOS POR ENTIDADE
// ================================================
var FIELDS={
  escola:['esc-nome','esc-cnpj','esc-rede','esc-etapa','esc-tel','esc-email','esc-end','esc-obs'],
  gestor:['ges-nome','ges-cpf','ges-escola','ges-cargo','ges-tel','ges-email','ges-formacao','ges-inicio','ges-obs','ges-user','ges-pass'],
  coordenador:['coo-nome','coo-cpf','coo-escola','coo-area','coo-turno','coo-tel','coo-email','coo-formacao','coo-obs','coo-user','coo-pass'],
  professor:['pro-nome','pro-cpf','pro-escola','pro-esp','pro-turno','pro-vinculo','pro-reg','pro-tel','pro-email','pro-formacao','pro-obs','pro-user','pro-pass'],
  turma:['tur-nome','tur-escola','tur-turno','tur-professor','tur-ano','tur-obs'],
  aluno:['alu-nome','alu-nasc','alu-sexo','alu-escola','alu-turma','alu-turno','alu-nee','alu-cid','alu-resp','alu-tel','alu-remail','alu-professor','alu-laudo','alu-adapt','alu-obs'],
  'reg-aluno':['ra-aluno','ra-data','ra-tipo','ra-area','ra-ativ','ra-evol','ra-obs'],
  sessao:['ses-data','ses-hora','ses-professor','ses-local','ses-tema','ses-alunos','ses-ativ','ses-rec','ses-obs'],
  desempenho:['des-data','des-aluno','des-area','des-nivel','des-obs','des-rec'],
  // Campos para o modal de edição de frequência
  frequencia_edit:['edit-fre-status','edit-fre-justificativa']
};

function getFieldKeys(type){
  var map={
    escola:['nome','cnpj','rede','etapa','tel','email','end','obs'],
    gestor:['nome','cpf','escola','cargo','tel','email','formacao','inicio','obs','user','pass'],
    coordenador:['nome','cpf','escola','area','turno','tel','email','formacao','obs','user','pass'],
    professor:['nome','cpf','escola','esp','turno','vinculo','reg','tel','email','formacao','obs','user','pass'],
    turma:['nome','escola','turno','professor','ano','obs'],
    aluno:['nome','nasc','sexo','escola','turma','turno','nee','cid','resp','tel','remail','professor','laudo','adapt','obs'],
    'reg-aluno':['aluno','data','tipo','area','ativ','evol','obs'],
    sessao:['data','hora','professor','local','tema','alunos','ativ','rec','obs'],
    frequencia:['data','turma','aluno','status','justificativa'],
    desempenho:['data','aluno','area','nivel','obs','rec'],
    // Chaves para o modal de edição de frequência
    frequencia_edit:['status','justificativa']
  };
  return map[type]||[];
}

function lerCampos(type){
  var ids=FIELDS[type]; var keys=getFieldKeys(type); var obj={};
  ids.forEach(function(fid,i){
    var el=document.getElementById(fid);
    if(!el){obj[keys[i]]='';return;}
    if(el.tagName==='SELECT'&&el.multiple){
      obj[keys[i]]=Array.from(el.selectedOptions).map(function(o){return o.value;}).join(', ');
    } else { obj[keys[i]]=el.value; }
  });
  return obj;
}

function preencherCampos(type,obj){
  var ids=FIELDS[type]; var keys=getFieldKeys(type);
  ids.forEach(function(fid,i){
    var el=document.getElementById(fid); if(!el) return;
    var val=obj[keys[i]]||'';
    if(el.tagName==='SELECT'&&el.multiple){
      var vals=val.split(', ');
      Array.from(el.options).forEach(function(op){ op.selected=vals.indexOf(op.value)>=0; });
    } else { el.value=val; }
  });
}

function validar(type,obj){
  var required={
    escola:['nome'],gestor:['nome','cpf'],coordenador:['nome','cpf'],
    professor:['nome','cpf'],turma:['nome'],aluno:['nome'],
    'reg-aluno':['aluno','data'],sessao:['data'],desempenho:['data','aluno']
  };
  var req=required[type]||[];
  for(var i=0;i<req.length;i++){
    if(!obj[req[i]]||obj[req[i]].trim()===''){
      toast('Campo obrigatório não preenchido: '+req[i],'terr'); return false;
    }
  }
  return true;
}

var prefixMap={
  escola:'esc',gestor:'ges',coordenador:'coo',professor:'pro',
  turma:'tur',aluno:'alu','reg-aluno':'ra',sessao:'ses',desempenho:'des'
};

// ================================================
// SALVAR — envia automaticamente para Sheets
// ================================================
function salvar(type){
  // Validação de permissão para gestores e coordenadores
  if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
    // Gestores e Coordenadores podem cadastrar professor, turma, aluno, reg-aluno, sessao, frequencia, desempenho
    const allowedTypes = ['professor', 'turma', 'aluno', 'reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para cadastrar este tipo de registro.','terr');
      return;
    }
  }
  // Validação de permissão para professores
  if (currentUser.role === 'professor') {
    const allowedTypes = ['reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para cadastrar este tipo de registro.','terr');
      return;
    }
  }

  popularSelects();
  var obj=lerCampos(type);
  if(!validar(type,obj)) return;

  // Filtrar por escola para gestores/coordenadores
  if ((currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    // Para professor, turma, aluno, verifica se a escola do registro corresponde à escola do usuário
    if (['professor', 'turma', 'aluno'].includes(type) && obj.escola && obj.escola !== currentUser.escola) {
      toast('Você só pode cadastrar registros para a sua escola (' + currentUser.escola + ').','terr');
      return;
    }
    // Para reg-aluno, sessao, frequencia, desempenho, verifica se o aluno ou professor pertence à escola do usuário
    if (['reg-aluno', 'sessao', 'frequencia', 'desempenho'].includes(type)) {
      let isAllowed = false;
      if (obj.aluno) { // Para reg-aluno, frequencia, desempenho
        const aluno = DB.aluno.find(a => a.nome === obj.aluno);
        if (aluno && aluno.escola === currentUser.escola) isAllowed = true;
      } else if (obj.professor) { // Para sessao
        const professor = DB.professor.find(p => p.nome === obj.professor);
        if (professor && professor.escola === currentUser.escola) isAllowed = true;
      }
      if (!isAllowed) {
        toast('Você só pode cadastrar registros para alunos ou professores da sua escola (' + currentUser.escola + ').','terr');
        return;
      }
    }
  }

  DB[type].push(obj);

  // Envio automático para Google Sheets ao salvar
  if(SHEETS_URL){
    var payload = {
      aba: ABAS[type],
      acao: 'inserir',
      linha: montarLinha(type, obj),
      usuario: currentUser ? currentUser.nome : 'Sistema'
    };
    fetch(SHEETS_URL, {
      method:'POST', mode:'no-cors',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(function(){
      toast('💾 Salvo localmente e na planilha!','tok');
    }).catch(function(){
      toast('💾 Salvo localmente. Erro ao enviar para planilha.','tinf');
    });
  }

  limpar(type);
  // Não renderiza a tabela de frequência aqui para que só apareça ao buscar
  if (type !== 'frequencia') {
    renderTabela(type);
  }
  popularSelects();
  atualizarDashboard();
  if(!SHEETS_URL) toast('Registro salvo com sucesso!','tok');
}

// ================================================
// ATUALIZAR
// ================================================
function atualizar(type){
  // Validação de permissão para gestores e coordenadores
  if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
    const allowedTypes = ['professor', 'turma', 'aluno', 'reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para atualizar este tipo de registro.','terr');
      return;
    }
  }
  // Validação de permissão para professores
  if (currentUser.role === 'professor') {
    const allowedTypes = ['reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para atualizar este tipo de registro.','terr');
      return;
    }
  }

  var idx=editIdx[type]; if(idx<0) return;
  var obj=lerCampos(type);
  if(!validar(type,obj)) return;

  // Filtrar por escola para gestores/coordenadores
  if ((currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    // Para professor, turma, aluno, verifica se a escola do registro corresponde à escola do usuário
    if (['professor', 'turma', 'aluno'].includes(type) && obj.escola && obj.escola !== currentUser.escola) {
      toast('Você só pode atualizar registros para a sua escola (' + currentUser.escola + ').','terr');
      return;
    }
    // Para reg-aluno, sessao, frequencia, desempenho, verifica se o aluno ou professor pertence à escola do usuário
    if (['reg-aluno', 'sessao', 'frequencia', 'desempenho'].includes(type)) {
      let isAllowed = false;
      if (obj.aluno) { // Para reg-aluno, frequencia, desempenho
        const aluno = DB.aluno.find(a => a.nome === obj.aluno);
        if (aluno && aluno.escola === currentUser.escola) isAllowed = true;
      } else if (obj.professor) { // Para sessao
        const professor = DB.professor.find(p => p.nome === obj.professor);
        if (professor && professor.escola === currentUser.escola) isAllowed = true;
      }
      if (!isAllowed) {
        toast('Você só pode atualizar registros para alunos ou professores da sua escola (' + currentUser.escola + ').','terr');
        return;
      }
    }
  }

  DB[type][idx]=obj; // Atualiza no DB local

  // Envia TODOS os registros daquele tipo para o Sheets, limpando e reescrevendo a aba
  if(SHEETS_URL){
    var payload={
      aba: ABAS[type],
      acao: 'limparEReescrever',
      linhas: DB[type].map(function(o){ return montarLinha(type,o); }),
      usuario: currentUser ? currentUser.nome : 'Sistema'
    };
    fetch(SHEETS_URL,{
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  }

  cancelEdit(type);
  // Não renderiza a tabela de frequência aqui para que só apareça ao buscar
  if (type !== 'frequencia') {
    renderTabela(type);
  }
  popularSelects();
  atualizarDashboard();
  toast('Registro atualizado com sucesso!','tok');
}
// ================================================
// EXCLUIR
// ================================================
function excluir(type,idx){
  // Validação de permissão para gestores e coordenadores
  if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
    const allowedTypes = ['professor', 'turma', 'aluno', 'reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para excluir este tipo de registro.','terr');
      return;
    }
  }
  // Validação de permissão para professores
  if (currentUser.role === 'professor') {
    const allowedTypes = ['reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para excluir este tipo de registro.','terr');
      return;
    }
  }

  if(!confirm('Deseja excluir este registro?')) return;

  // Filtrar por escola para gestores/coordenadores
  if ((currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    const record = DB[type][idx];
    // Para professor, turma, aluno, verifica se a escola do registro corresponde à escola do usuário
    if (['professor', 'turma', 'aluno'].includes(type) && record.escola && record.escola !== currentUser.escola) {
      toast('Você só pode excluir registros da sua escola (' + currentUser.escola + ').','terr');
      return;
    }
    // Para reg-aluno, sessao, frequencia, desempenho, verifica se o aluno ou professor pertence à escola do usuário
    if (['reg-aluno', 'sessao', 'frequencia', 'desempenho'].includes(type)) {
      let isAllowed = false;
      if (record.aluno) { // Para reg-aluno, frequencia, desempenho
        const aluno = DB.aluno.find(a => a.nome === record.aluno);
        if (aluno && aluno.escola === currentUser.escola) isAllowed = true;
      } else if (record.professor) { // Para sessao
        const professor = DB.professor.find(p => p.nome === record.professor);
        if (professor && professor.escola === currentUser.escola) isAllowed = true;
      }
      if (!isAllowed) {
        toast('Você só pode excluir registros para alunos ou professores da sua escola (' + currentUser.escola + ').','terr');
        return;
      }
    }
  }

  DB[type].splice(idx,1); // Remove do DB local

  // Envia TODOS os registros restantes daquele tipo para o Sheets, limpando e reescrevendo a aba
  if(SHEETS_URL){
    var payload={
      aba: ABAS[type],
      acao: 'limparEReescrever',
      linhas: DB[type].map(function(o){ return montarLinha(type,o); }),
      usuario: currentUser ? currentUser.nome : 'Sistema'
    };
    fetch(SHEETS_URL,{
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  }

  // Não renderiza a tabela de frequência aqui para que só apareça ao buscar
  if (type !== 'frequencia') {
    renderTabela(type);
  } else {
    // Se for frequência, re-renderiza a tabela de frequência após a exclusão
    // para refletir a mudança, mas apenas se já estiver sendo exibida (após uma busca)
    if (document.getElementById('tb-frequencia').innerHTML !== '<tr class="erow"><td colspan="6">Nenhum registro cadastrado.</td></tr>') {
      renderTabela('frequencia');
    }
  }
  popularSelects();
  atualizarDashboard();
  toast('Registro excluído.','tinf');
}

// ================================================
// EDITAR
// ================================================
function editar(type,idx){
  // Validação de permissão para gestores e coordenadores
  if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
    const allowedTypes = ['professor', 'turma', 'aluno', 'reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para editar este tipo de registro.','terr');
      return;
    }
  }
  // Validação de permissão para professores
  if (currentUser.role === 'professor') {
    const allowedTypes = ['reg-aluno', 'sessao', 'frequencia', 'desempenho'];
    if (!allowedTypes.includes(type)) {
      toast('Você não tem permissão para editar este tipo de registro.','terr');
      return;
    }
  }

  // Filtrar por escola para gestores/coordenadores
  if ((currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    const record = DB[type][idx];
    // Para professor, turma, aluno, verifica se a escola do registro corresponde à escola do usuário
    if (['professor', 'turma', 'aluno'].includes(type) && record.escola && record.escola !== currentUser.escola) {
      toast('Você só pode editar registros da sua escola (' + currentUser.escola + ').','terr');
      return;
    }
    // Para reg-aluno, sessao, frequencia, desempenho, verifica se o aluno ou professor pertence à escola do usuário
    if (['reg-aluno', 'sessao', 'frequencia', 'desempenho'].includes(type)) {
      let isAllowed = false;
      if (record.aluno) { // Para reg-aluno, frequencia, desempenho
        const aluno = DB.aluno.find(a => a.nome === record.aluno);
        if (aluno && aluno.escola === currentUser.escola) isAllowed = true;
      } else if (record.professor) { // Para sessao
        const professor = DB.professor.find(p => p.nome === record.professor);
        if (professor && professor.escola === currentUser.escola) isAllowed = true;
      }
      if (!isAllowed) {
        toast('Você só pode editar registros para alunos ou professores da sua escola (' + currentUser.escola + ').','terr');
        return;
      }
    }
  }

  if(type === 'frequencia'){
    var record = DB.frequencia[idx];
    editIdx.frequencia = idx; // Armazena o índice para edição
    document.getElementById('edit-fre-data').textContent = esc(record.data);
    document.getElementById('edit-fre-turma').textContent = esc(record.turma);
    document.getElementById('edit-fre-aluno').textContent = esc(record.aluno);
    document.getElementById('edit-fre-status').value = record.status;
    document.getElementById('edit-fre-justificativa').value = record.justificativa;
    document.getElementById('modal-edit-frequencia').classList.add('show');
    return; // Sai da função para não usar o fluxo de edição genérico
  }

  editIdx[type]=idx;
  popularSelects();
  preencherCampos(type,DB[type][idx]);
  var ban=document.getElementById('ban-'+type);
  if(ban) ban.classList.add('show');
  var ts=document.getElementById('t-'+type);
  var labels={escola:'Escola',gestor:'Gestor',coordenador:'Coordenador',professor:'Professor',
              turma:'Turma',aluno:'Aluno','reg-aluno':'Registro por Aluno',
              sessao:'Sessão',frequencia:'Frequência',desempenho:'Desempenho'};
  if(ts) ts.textContent='✏️ Editando: '+(labels[type]||type);
  var px=prefixMap[type]||type.substring(0,3);
  var bs=document.getElementById('b'+px+'-s');
  var ba=document.getElementById('b'+px+'-a');
  if(bs) bs.style.display='none';
  if(ba) ba.style.display='';
  var card=document.querySelector('#page-'+type+' .card');
  if(!card) card=document.querySelector('#page-por-aluno .card');
  if(card) card.scrollIntoView({behavior:'smooth'});
}

// ================================================
// CANCELAR EDIÇÃO
// ================================================
function cancelEdit(type){
  editIdx[type]=-1;
  var ban=document.getElementById('ban-'+type);
  if(ban) ban.classList.remove('show');
  var ts=document.getElementById('t-'+type);
  var labels={escola:'Escola',gestor:'Gestor',coordenador:'Coordenador',professor:'Professor',
              turma:'Turma',aluno:'Aluno','reg-aluno':'Registro por Aluno',
              sessao:'Sessão',frequencia:'Frequência',desempenho:'Desempenho'};
  if(ts) ts.textContent='➕ Novo Cadastro de '+(labels[type]||type);
  var px=prefixMap[type]||type.substring(0,3);
  var bs=document.getElementById('b'+px+'-s');
  var ba=document.getElementById('b'+px+'-a');
  if(bs) bs.style.display='';
  if(ba) ba.style.display='none';
  limpar(type);
}

// ================================================
// LIMPAR FORMULÁRIO
// ================================================
function limpar(type){
  var ids=FIELDS[type]; if(!ids) return;
  ids.forEach(function(fid){
    var el=document.getElementById(fid); if(!el) return;
    if(el.tagName==='SELECT'&&el.multiple){
      Array.from(el.options).forEach(function(op){op.selected=false;});
    } else { el.value=''; }
  });
  if(type==='frequencia'){
    document.getElementById('fre-turma').value = ''; // Limpa a seleção da turma
    document.getElementById('fre-lista').innerHTML=
      '<div style="text-align:center;color:var(--mu);padding:20px;font-style:italic">👆 Selecione uma turma para carregar os alunos.</div>';
  }
}

// ================================================
// FREQUÊNCIA ESPECIAL
// ================================================
function salvarFrequencia(){
  // Validação de permissão para gestores e coordenadores
  if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
    // Gestores e Coordenadores podem cadastrar frequência
  } else if (currentUser.role === 'professor') {
    // Professores podem cadastrar frequência
  } else { // Admin
    toast('Apenas gestores, coordenadores e professores podem cadastrar frequência.','terr');
    return;
  }

  var data=document.getElementById('fre-data').value;
  var turma=document.getElementById('fre-turma').value;
  if(!data||!turma){toast('Informe data e turma!','terr');return;}
  var lista=document.getElementById('fre-lista');
  var items=lista.querySelectorAll('.fi');
  if(items.length===0){toast('Nenhum aluno carregado!','terr');return;}
  var count=0;
  items.forEach(function(item){
    var nome=item.querySelector('.fn').textContent;
    var sel=item.querySelector('select[name^="freq_"]'); // Seleciona o select de frequência
    var justSel=item.querySelector('select[name^="just_"]'); // Seleciona o select de justificativa
    var obj={data:data,turma:turma,aluno:nome,
             status:sel?sel.value:'Presente',
             justificativa:justSel?justSel.value:''};
    DB.frequencia.push(obj);
    // Envia para Sheets automaticamente
    if(SHEETS_URL){
      var payload={
        aba:ABAS['frequencia'],acao:'inserir',
        linha:montarLinha('frequencia',obj),
        usuario:currentUser?currentUser.nome:'Sistema'
      };
      fetch(SHEETS_URL,{method:'POST',mode:'no-cors',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)});
    }
    count++;
  });
  // Não renderiza a tabela de frequência aqui, pois ela só aparece ao buscar
  // renderTabela('frequencia');
  limpar('frequencia');
  atualizarDashboard();
  toast(count+' registros de frequência salvos!','tok');
}

// Nova função para salvar edição de frequência
function salvarEdicaoFrequencia(){
  var idx = editIdx.frequencia;
  if(idx < 0) return; // Nenhum item em edição

  var obj = DB.frequencia[idx]; // Pega o objeto original
  obj.status = document.getElementById('edit-fre-status').value;
  obj.justificativa = document.getElementById('edit-fre-justificativa').value;

  // Validação de permissão para gestores e coordenadores (similar ao salvar/atualizar geral)
  if ((currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    const aluno = DB.aluno.find(a => a.nome === obj.aluno);
    if (!aluno || aluno.escola !== currentUser.escola) {
      toast('Você só pode atualizar registros para alunos da sua escola (' + currentUser.escola + ').','terr');
      return;
    }
  } else if (currentUser.role === 'professor') {
    var alunosPermitidos = getAlunosFiltrados().map(function(a){return a.nome;});
    if (alunosPermitidos.indexOf(obj.aluno) === -1) {
      toast('Você só pode atualizar registros para alunos da sua turma.','terr');
      return;
    }
  }

  // Envia TODOS os registros daquele tipo para o Sheets, limpando e reescrevendo a aba
  if(SHEETS_URL){
    var payload={
      aba: ABAS.frequencia,
      acao: 'limparEReescrever',
      linhas: DB.frequencia.map(function(o){ return montarLinha('frequencia',o); }),
      usuario: currentUser ? currentUser.nome : 'Sistema'
    };
    fetch(SHEETS_URL,{
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  }

  fecharModalEditFrequencia();
  renderTabela('frequencia'); // Re-renderiza a tabela após a edição
  atualizarDashboard();
  toast('Registro de frequência atualizado com sucesso!','tok');
}

function fecharModalEditFrequencia(){
  document.getElementById('modal-edit-frequencia').classList.remove('show');
  editIdx.frequencia = -1; // Limpa o índice de edição
}

// ================================================
// HELPERS
// ================================================
function esc(str){
  if(!str) return '';
  return String(str).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'&quot;');
}
function trunca(str,n){
  if(!str) return ''; str=String(str);
  return str.length>n?str.substring(0,n)+'…':str;
}
function td(v){ return '<td>'+esc(v||'—')+'</td>'; }

// ================================================
// RENDERIZAR TABELAS
// ================================================
function renderTabela(type){
  var tbody=document.getElementById('tb-'+type);
  var cnt=document.getElementById('cnt-'+type);
  if(!tbody) return;
  var data=DB[type];

  // Filtragem por papel e escola
  if(currentUser){
    if(currentUser.role === 'professor'){
      var alunosPermitidos=getAlunosFiltrados().map(function(a){return a.nome;});
      if(type==='aluno'){
        data=getAlunosFiltrados();
      } else if(type==='reg-aluno'){
        data=DB['reg-aluno'].filter(function(r){ return alunosPermitidos.indexOf(r.aluno)>=0; });
      } else if(type==='sessao'){
        data=DB.sessao.filter(function(s){
          if(s.professor===currentUser.nome) return true;
          var alunosSessao=(s.alunos||'').split(', ');
          return alunosSessao.some(function(an){ return alunosPermitidos.indexOf(an.trim())>=0; });
        });
      } else if(type==='frequencia'){
        data=DB.frequencia.filter(function(f){ return alunosPermitidos.indexOf(f.aluno)>=0; });
      } else if(type==='desempenho'){
        data=DB.desempenho.filter(function(d){ return alunosPermitidos.indexOf(d.aluno)>=0; });
      }
    } else if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
      // Gestores e Coordenadores veem apenas dados da sua escola
      if (type === 'escola') { // Só a própria escola
        data = DB.escola.filter(function(e) { return e.nome === currentUser.escola; });
      } else if (['professor', 'turma', 'aluno'].includes(type)) { // Professores, Turmas, Alunos da sua escola
        data = DB[type].filter(function(item) { return item.escola === currentUser.escola; });
      } else if (['reg-aluno', 'sessao', 'frequencia', 'desempenho'].includes(type)) { // Registros de alunos/professores da sua escola
        data = DB[type].filter(function(item) {
          if (item.aluno) {
            const aluno = DB.aluno.find(a => a.nome === item.aluno);
            return aluno && aluno.escola === currentUser.escola;
          } else if (item.professor) {
            const professor = DB.professor.find(p => p.nome === item.professor);
            return professor && professor.escola === currentUser.escola;
          }
          return false;
        });
      } else { // Outros tipos (gestor, coordenador) só se for admin
        data = [];
      }
    }
  }

  // Adicionar filtragem por data e turma para a tabela de frequência
  if(type === 'frequencia'){
    var filterDate = document.getElementById('filter-fre-data').value;
    var filterTurma = document.getElementById('filter-fre-turma').value;

    // Popular o select de filtro de turma
    var filterTurmaSelect = document.getElementById('filter-fre-turma');
    if (filterTurmaSelect) { // Popula sempre para garantir que esteja atualizado
      var currentSelected = filterTurmaSelect.value;
      filterTurmaSelect.innerHTML = '<option value="">Todas as Turmas</option>';
      var turmasUnicas = [...new Set(DB.frequencia.map(f => f.turma))].sort();
      turmasUnicas.forEach(function(t){
        var op = document.createElement('option');
        op.value = t;
        op.textContent = t;
        filterTurmaSelect.appendChild(op);
      });
      filterTurmaSelect.value = currentSelected; // Mantém a seleção após popular
    }

    data = data.filter(function(f){
      var matchesDate = filterDate ? f.data === filterDate : true;
      var matchesTurma = filterTurma ? f.turma === filterTurma : true;
      return matchesDate && matchesTurma;
    });
  }

  if(cnt) cnt.textContent=data.length;
  if(data.length===0){
    tbody.innerHTML='<tr class="erow"><td colspan="20">Nenhum registro cadastrado.</td></tr>';
    return;
  }
  var html='';
  data.forEach(function(r){
    var realIdx=DB[type].indexOf(r);
    html+='<tr>';
    if(type==='escola'){
      html+=td(r.nome)+td(r.cnpj)+td(r.rede)+td(r.etapa)+td(r.tel)+td(r.email)+td(trunca(r.end,30))+td(trunca(r.obs,25));
    } else if(type==='gestor'){
      html+=td(r.nome)+td(r.cpf)+td(r.escola)+td(r.cargo)+td(r.tel)+td(r.email)+td(r.formacao)+td(r.inicio);
    } else if(type==='coordenador'){
      html+=td(r.nome)+td(r.cpf)+td(r.escola)+td(r.area)+td(r.turno)+td(r.tel)+td(r.email)+td(r.formacao);
    } else if(type==='professor'){
      html+=td(r.nome)+td(r.cpf)+td(r.escola)+td(r.esp)+td(r.turno)+td(r.vinculo)+td(r.tel)+td(r.email);
    } else if(type==='turma'){
      html+=td(r.nome)+td(r.escola)+td(r.turno)+td(r.professor)+td(trunca(r.ano,25))+td(trunca(r.obs,25));
    } else if(type==='aluno'){
      html+=td(r.nome)+td(r.nasc)+td(r.sexo)+td(r.escola)+td(r.turma)+td(r.turno)+td(r.nee)+td(r.cid)+td(r.resp)+td(r.tel)+td(r.professor);
    } else if(type==='reg-aluno'){
      html+=td(r.data)+td(r.aluno)+td(r.tipo)+td(r.area)+td(trunca(r.ativ,30))+td(trunca(r.evol,30))+td(trunca(r.obs,25));
    } else if(type==='sessao'){
      html+=td(r.data)+td(r.hora)+td(r.professor)+td(r.tema)+td(trunca(r.alunos,30))+td(trunca(r.ativ,30))+td(trunca(r.rec,25))+td(trunca(r.obs,20));
    } else if(type==='frequencia'){
      var badge=r.status==='Presente'?'<span class="badge bg2">'+esc(r.status)+'</span>':
                r.status==='Justificado'?'<span class="badge by">'+esc(r.status)+'</span>':
                '<span class="badge br2">'+esc(r.status)+'</span>';
      html+=td(r.data)+td(r.turma)+td(r.aluno)+'<td>'+badge+'</td>'+td(r.justificativa);
    } else if(type==='desempenho'){
      var badge2=r.nivel==='Consolidado'||r.nivel==='Avançado'?'<span class="badge bg2">'+esc(r.nivel)+'</span>':
                 r.nivel==='Em Desenvolvimento'?'<span class="badge by">'+esc(r.nivel)+'</span>':
                 '<span class="badge br2">'+esc(r.nivel)+'</span>';
      html+=td(r.data)+td(r.aluno)+td(r.area)+'<td>'+badge2+'</td>'+td(trunca(r.obs,30))+td(trunca(r.rec,25));
    }
    html+='<td><div class="ab">';
    html+='<button class="bic v" title="Visualizar" onclick="verDetalhe(\''+type+'\','+realIdx+')">👁</button>';

    // Lógica de permissão para botões de editar e excluir
    if(currentUser && currentUser.role === 'admin'){
      html+='<button class="bic e" title="Editar" onclick="editar(\''+type+'\','+realIdx+')">✏️</button>';
      html+='<button class="bic d" title="Excluir" onclick="excluir(\''+type+'\','+realIdx+')">🗑</button>';
    } else if(currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')){
      const allowedTypes = ['professor', 'turma', 'aluno', 'reg-aluno', 'sessao', 'frequencia', 'desempenho'];
      if(allowedTypes.includes(type)){
        html+='<button class="bic e" title="Editar" onclick="editar(\''+type+'\','+realIdx+')">✏️</button>';
        html+='<button class="bic d" title="Excluir" onclick="excluir(\''+type+'\','+realIdx+')">🗑</button>';
      }
    } else if(currentUser && currentUser.role === 'professor'){
      const allowedTypes = ['reg-aluno','sessao','frequencia','desempenho'];
      if(allowedTypes.includes(type)){
        html+='<button class="bic e" title="Editar" onclick="editar(\''+type+'\','+realIdx+')">✏️</button>';
        html+='<button class="bic d" title="Excluir" onclick="excluir(\''+type+'\','+realIdx+')">🗑</button>';
      }
    }
    html+='</div></td></tr>';
  });
  tbody.innerHTML=html;
}

// ================================================
// MODAL DE VISUALIZAÇÃO
// ================================================
function verDetalhe(type,idx){
  var r=DB[type][idx]; if(!r) return;
  var labels={
    escola:{nome:'Nome',cnpj:'CNPJ',rede:'Rede',etapa:'Etapa',tel:'Telefone',email:'E-mail',end:'Endereço',obs:'Observações'},
    gestor:{nome:'Nome',cpf:'CPF',escola:'Escola',cargo:'Cargo',tel:'Telefone',email:'E-mail',formacao:'Formação',inicio:'Início',obs:'Observações'},
    coordenador:{nome:'Nome',cpf:'CPF',escola:'Escola',area:'Área',turno:'Turno',tel:'Telefone',email:'E-mail',formacao:'Formação',obs:'Observações'},
    professor:{nome:'Nome',cpf:'CPF',escola:'Escola',esp:'Especialidade',turno:'Turno',vinculo:'Vínculo',reg:'Registro',tel:'Telefone',email:'E-mail',formacao:'Formação',obs:'Observações'},
    turma:{nome:'Turma',escola:'Escola',turno:'Turno',professor:'Professor',ano:'Ano Letivo',obs:'Observações'},
    aluno:{nome:'Nome',nasc:'Nascimento',sexo:'Sexo',escola:'Escola',turma:'Turma',turno:'Turno',nee:'NEE',cid:'CID-10',resp:'Responsável',tel:'Telefone',remail:'E-mail Resp.',professor:'Prof. AEE',laudo:'Laudo',adapt:'Adaptações',obs:'Observações'},
    'reg-aluno':{aluno:'Aluno',data:'Data',tipo:'Tipo',area:'Área',ativ:'Atividades',evol:'Evolução',obs:'Observações'},
    sessao:{data:'Data',hora:'Horário',professor:'Professor',local:'Local',tema:'Tema',alunos:'Alunos',ativ:'Atividades',rec:'Recursos',obs:'Observações'},
    frequencia:{data:'Data',turma:'Turma',aluno:'Aluno',status:'Status',justificativa:'Justificativa'},
    desempenho:{data:'Data',aluno:'Aluno',area:'Área',nivel:'Nível',obs:'Observações',rec:'Recomendações'}
  };
  var lbs=labels[type]||{};
  var typeNames={escola:'Escola',gestor:'Gestor',coordenador:'Coordenador',professor:'Professor',
                 turma:'Turma',aluno:'Aluno','reg-aluno':'Registro por Aluno',
                 sessao:'Sessão',frequencia:'Frequência',desempenho:'Desempenho'};
  document.getElementById('modal-title').textContent='📋 Detalhe: '+(typeNames[type]||type);
  var html='<div class="dr">';
  Object.keys(lbs).forEach(function(k){
    html+='<div class="di2"><div class="dl">'+lbs[k]+'</div><div class="dv">'+esc(r[k]||'—')+'</div></div>';
  });
  html+='</div>';
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-view').classList.add('show');
}

function fecharModal(){
  document.getElementById('modal-view').classList.remove('show');
}

document.getElementById('modal-view').addEventListener('click',function(e){
  if(e.target===this) fecharModal();
});

// ================================================
// DASHBOARD
// ================================================
function atualizarDashboard(){
  var avisoProf=document.getElementById('aviso-prof');
  var alunosFiltrados=getAlunosFiltrados();
  if(currentUser && currentUser.role==='professor'){
    if(avisoProf) avisoProf.classList.add('show');
    var minhasSessoes=DB.sessao.filter(function(s){ return s.professor === currentUser.nome; });
    var nomesFiltrados=alunosFiltrados.map(function(a){ return a.nome; });
    var minhasFreqs=DB.frequencia.filter(function(f){ return nomesFiltrados.indexOf(f.aluno)>=0; });
    document.getElementById('d-esc').textContent=DB.escola.length;
    document.getElementById('d-alu').textContent=alunosFiltrados.length;
    document.getElementById('d-pro').textContent=DB.professor.length;
    document.getElementById('d-ses').textContent=minhasSessoes.length;
    document.getElementById('d-fre').textContent=minhasFreqs.length;
    var tbs=document.getElementById('d-sessoes');
    var ses=minhasSessoes.slice(-5).reverse();
    tbs.innerHTML=ses.length===0?'<tr class="erow"><td colspan="4">Nenhuma sessão registrada.</td></tr>':
      ses.map(function(s){return '<tr>'+td(s.data)+td(s.professor)+td(s.tema)+td(s.alunos)+'</tr>';}).join('');
    var tba=document.getElementById('d-alunos');
    var alu=alunosFiltrados.slice(-5).reverse();
    tba.innerHTML=alu.length===0?'<tr class="erow"><td colspan="4">Nenhum aluno cadastrado.</td></tr>':
      alu.map(function(a){return '<tr>'+td(a.nome)+td(a.nee)+td(a.escola)+td(a.turma)+'</tr>';}).join('');
  } else if (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    if(avisoProf) avisoProf.classList.remove('show'); // Não mostrar aviso de professor
    var escolasFiltradas = DB.escola.filter(e => e.nome === currentUser.escola);
    var alunosDaEscola = DB.aluno.filter(a => a.escola === currentUser.escola);
    var professoresDaEscola = DB.professor.filter(p => p.escola === currentUser.escola);
    var sessoesDaEscola = DB.sessao.filter(s => {
      const professorSessao = DB.professor.find(p => p.nome === s.professor);
      return professorSessao && professorSessao.escola === currentUser.escola;
    });
    var frequenciasDaEscola = DB.frequencia.filter(f => {
      const alunoFreq = DB.aluno.find(a => a.nome === f.aluno);
      return alunoFreq && alunoFreq.escola === currentUser.escola;
    });

    document.getElementById('d-esc').textContent=escolasFiltradas.length;
    document.getElementById('d-alu').textContent=alunosDaEscola.length;
    document.getElementById('d-pro').textContent=professoresDaEscola.length;
    document.getElementById('d-ses').textContent=sessoesDaEscola.length;
    document.getElementById('d-fre').textContent=frequenciasDaEscola.length;

    var tbs=document.getElementById('d-sessoes');
    var ses=sessoesDaEscola.slice(-5).reverse();
    tbs.innerHTML=ses.length===0?'<tr class="erow"><td colspan="4">Nenhuma sessão registrada.</td></tr>':
      ses.map(function(s){return '<tr>'+td(s.data)+td(s.professor)+td(s.tema)+td(s.alunos)+'</tr>';}).join('');
    var tba=document.getElementById('d-alunos');
    var alu=alunosDaEscola.slice(-5).reverse();
    tba.innerHTML=alu.length===0?'<tr class="erow"><td colspan="4">Nenhum aluno cadastrado.</td></tr>':
      alu.map(function(a){return '<tr>'+td(a.nome)+td(a.nee)+td(a.escola)+td(a.turma)+'</tr>';}).join('');

  } else { // Admin
    if(avisoProf) avisoProf.classList.remove('show');
    document.getElementById('d-esc').textContent=DB.escola.length;
    document.getElementById('d-alu').textContent=DB.aluno.length;
    document.getElementById('d-pro').textContent=DB.professor.length;
    document.getElementById('d-ses').textContent=DB.sessao.length;
    document.getElementById('d-fre').textContent=DB.frequencia.length;
    var tbs=document.getElementById('d-sessoes');
    var ses=DB.sessao.slice(-5).reverse();
    tbs.innerHTML=ses.length===0?'<tr class="erow"><td colspan="4">Nenhuma sessão registrada.</td></tr>':
      ses.map(function(s){return '<tr>'+td(s.data)+td(s.professor)+td(s.tema)+td(s.alunos)+'</tr>';}).join('');
    var tba=document.getElementById('d-alunos');
    var alu=DB.aluno.slice(-5).reverse();
    tba.innerHTML=alu.length===0?'<tr class="erow"><td colspan="4">Nenhum aluno cadastrado.</td></tr>':
      alu.map(function(a){return '<tr>'+td(a.nome)+td(a.nee)+td(a.escola)+td(a.turma)+'</tr>';}).join('');
  }
}

// ================================================
// TOAST
// ================================================
function toast(msg,tipo){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show '+(tipo||'tinf');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(function(){ t.classList.remove('show'); },3200);
}

// ================================================
// PDF DASHBOARD
// ================================================
function pdfDash(){
  var doc=new jspdf.jsPDF();
  doc.setFontSize(18); doc.setTextColor(26,58,92);
  doc.text('Diário AEE — Dashboard',14,20);
  doc.setFontSize(11); doc.setTextColor(80,80,80);
  doc.text('Gerado em: '+new Date().toLocaleString('pt-BR'),14,30);
  if(currentUser && currentUser.role==='professor'){
    doc.text('Professor: '+currentUser.nome,14,38);
  } else if (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'coordenador')) {
    doc.text('Escola: '+currentUser.escola,14,38);
  }

  var alunosFiltrados=getAlunosFiltrados();
  var rows=[
    ['Escolas',String(DB.escola.length)],
    ['Alunos'+(currentUser&&currentUser.role==='professor'?' (sua turma)':(currentUser&&(currentUser.role==='gestor'||currentUser.role==='coordenador')?' (sua escola)':'')),String(alunosFiltrados.length)],
    ['Professores',String(DB.professor.length)],
    ['Sessões',String(DB.sessao.length)],
    ['Frequências Registradas',String(DB.frequencia.length)]
  ];
  doc.autoTable({
    startY:44,head:[['Item','Quantidade']],body:rows,
    headStyles:{fillColor:[26,58,92]},
    alternateRowStyles:{fillColor:[240,244,251]}
  });
  doc.save('dashboard-aee.pdf');
  toast('PDF do Dashboard gerado!','tok');
}

// ================================================
// GERAR PDF POR SEÇÃO
// ================================================
function gerarPDF(type){
  var doc=new jspdf.jsPDF('l','mm','a4');
  var names={
    escola:'Escolas',gestor:'Gestores',coordenador:'Coordenadores',
    professor:'Professores',turma:'Turmas',aluno:'Alunos',
    'reg-aluno':'Registros por Aluno',sessao:'Sessões',
    frequencia:'Frequência',desempenho:'Desempenho'
  };
  doc.setFontSize(16); doc.setTextColor(26,58,92);
  doc.text('Diário AEE — Relatório: '+(names[type]||type),14,18);
  doc.setFontSize(9); doc.setTextColor(100,100,100);
  doc.text('Gerado em: '+new Date().toLocaleString('pt-BR'),14,26);

  var headers={
    escola:[['Nome','CNPJ','Rede','Etapa','Telefone','E-mail','Endereço']],
    gestor:[['Nome','CPF','Escola','Cargo','Telefone','E-mail','Formação','Início']],
    coordenador:[['Nome','CPF','Escola','Área','Turno','Telefone','E-mail','Formação']],
    professor:[['Nome','CPF','Escola','Especialidade','Turno','Vínculo','Telefone','E-mail']],
    turma:[['Nome','Escola','Turno','Professor','Ano Letivo','Observações']],
    aluno:[['Nome','Nasc.','Sexo','Escola','Turma','Turno','NEE','CID','Responsável','Telefone']],
    'reg-aluno':[['Data','Aluno','Tipo','Área','Atividades','Evolução','Obs.']],
    sessao:[['Data','Hora','Professor','Tema','Alunos','Atividades','Recursos']],
    frequencia:[['Data','Turma','Aluno','Status','Justificativa']],
    desempenho:[['Data','Aluno','Área','Nível','Observações','Recomendações']]
  };
  var bodyFn={
    escola:function(r){return[r.nome,r.cnpj,r.rede,r.etapa,r.tel,r.email,r.end];},
    gestor:function(r){return[r.nome,r.cpf,r.escola,r.cargo,r.tel,r.email,r.formacao,r.inicio];},
    coordenador:function(r){return[r.nome,r.cpf,r.escola,r.area,r.turno,r.tel,r.email,r.formacao];},
    professor:function(r){return[r.nome,r.cpf,r.escola,r.esp,r.turno,r.vinculo,r.tel,r.email];},
    turma:function(r){return[r.nome,r.escola,r.turno,r.professor,r.ano,r.obs];},
    aluno:function(r){return[r.nome,r.nasc,r.sexo,r.escola,r.turma,r.turno,r.nee,r.cid,r.resp,r.tel];},
    'reg-aluno':function(r){return[r.data,r.aluno,r.tipo,r.area,trunca(r.ativ,40),trunca(r.evol,40),trunca(r.obs,30)];},
    sessao:function(r){return[r.data,r.hora,r.professor,r.tema,trunca(r.alunos,30),trunca(r.ativ,30),trunca(r.rec,25)];},
    frequencia:function(r){return[r.data,r.turma,r.aluno,r.status,r.justificativa];},
    desempenho:function(r){return[r.data,r.aluno,r.area,r.nivel,trunca(r.obs,35),trunca(r.rec,30)];}
  };

  var dadosBrutos=DB[type]||[];
  var dadosFiltrados=dadosBrutos;
  if(currentUser){
    if(currentUser.role==='professor'){
      var alunosPermitidos=getAlunosFiltrados().map(function(a){return a.nome;});
      if(type==='aluno') dadosFiltrados=getAlunosFiltrados();
      else if(type==='reg-aluno') dadosFiltrados=dadosBrutos.filter(function(r){return alunosPermitidos.indexOf(r.aluno)>=0;});
      else if(type==='sessao') dadosFiltrados=dadosBrutos.filter(function(s){
        if(s.professor===currentUser.nome) return true;
        return (s.alunos||'').split(', ').some(function(an){return alunosPermitidos.indexOf(an.trim())>=0;});
      });
      else if(type==='frequencia') dadosFiltrados=dadosBrutos.filter(function(f){return alunosPermitidos.indexOf(f.aluno)>=0;});
      else if(type==='desempenho') dadosFiltrados=dadosBrutos.filter(function(d){return alunosPermitidos.indexOf(d.aluno)>=0;});
    } else if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
      // Gestores e Coordenadores veem apenas dados da sua escola
      if (type === 'escola') { // Só a própria escola
        dadosFiltrados = DB.escola.filter(function(e) { return e.nome === currentUser.escola; });
      } else if (['professor', 'turma', 'aluno'].includes(type)) { // Professores, Turmas, Alunos da sua escola
        dadosFiltrados = DB[type].filter(function(item) { return item.escola === currentUser.escola; });
      } else if (['reg-aluno', 'sessao', 'frequencia', 'desempenho'].includes(type)) { // Registros de alunos/professores da sua escola
        dadosFiltrados = DB[type].filter(function(item) {
          if (item.aluno) {
            const aluno = DB.aluno.find(a => a.nome === item.aluno);
            return aluno && aluno.escola === currentUser.escola;
          } else if (item.professor) {
            const professor = DB.professor.find(p => p.nome === item.professor);
            return professor && professor.escola === currentUser.escola;
          }
          return false;
        });
      } else { // Outros tipos (gestor, coordenador) não são incluídos nos relatórios
        dadosFiltrados = [];
      }
    }
  }

  var body=dadosFiltrados.map(bodyFn[type]||function(r){return[JSON.stringify(r)];});
  if(body.length===0) body=[['Nenhum registro encontrado.']];

  doc.autoTable({
    startY:32,head:headers[type]||[['Dados']],body:body,
    headStyles:{fillColor:[26,58,92],fontSize:8},
    bodyStyles:{fontSize:7},
    alternateRowStyles:{fillColor:[240,244,251]},
    margin:{left:10,right:10}
  });
  doc.save('relatorio-'+type+'-aee.pdf');
  toast('PDF gerado com sucesso!','tok');
}

// ================================================
// EXPORTAR CSV
// ================================================
function exportCSV(type){
  var headers={
    escola:['Nome','CNPJ','Rede','Etapa','Telefone','E-mail','Endereço','Obs'],
    gestor:['Nome','CPF','Escola','Cargo','Telefone','E-mail','Formação','Início','Obs'],
    coordenador:['Nome','CPF','Escola','Área','Turno','Telefone','E-mail','Formação','Obs'],
    professor:['Nome','CPF','Escola','Especialidade','Turno','Vínculo','Registro','Telefone','E-mail','Formação','Obs'],
    turma:['Nome','Escola','Turno','Professor','Ano','Obs'],
    aluno:['Nome','Nasc.','Sexo','Escola','Turma','Turno','NEE','CID','Responsável','Telefone','E-mail Resp.','Prof. AEE','Laudo','Adaptações','Obs'],
    'reg-aluno':['Data','Aluno','Tipo','Área','Atividades','Evolução','Obs'],
    sessao:['Data','Hora','Professor','Local','Tema','Alunos','Atividades','Recursos','Obs'],
    frequencia:['Data','Turma','Aluno','Status','Justificativa'],
    desempenho:['Data','Aluno','Área','Nível','Obs','Recomendações']
  };
  var keys2={
    escola:['nome','cnpj','rede','etapa','tel','email','end','obs'],
    gestor:['nome','cpf','escola','cargo','tel','email','formacao','inicio','obs'],
    coordenador:['nome','cpf','escola','area','turno','tel','email','formacao','obs'],
    professor:['nome','cpf','escola','esp','turno','vinculo','reg','tel','email','formacao','obs'],
    turma:['nome','escola','turno','professor','ano','obs'],
    aluno:['nome','nasc','sexo','escola','turma','turno','nee','cid','resp','tel','remail','professor','laudo','adapt','obs'],
    'reg-aluno':['data','aluno','tipo','area','ativ','evol','obs'],
    sessao:['data','hora','professor','local','tema','alunos','ativ','rec','obs'],
    frequencia:['data','turma','aluno','status','justificativa'],
    desempenho:['data','aluno','area','nivel','obs','rec']
  };
  var dadosBrutos=DB[type]||[];
  var dados=dadosBrutos;
  if(currentUser){
    if(currentUser.role==='professor'){
      var alunosPermitidos=getAlunosFiltrados().map(function(a){return a.nome;});
      if(type==='aluno') dados=getAlunosFiltrados();
      else if(type==='reg-aluno') dados=dadosBrutos.filter(function(r){return alunosPermitidos.indexOf(r.aluno)>=0;});
      else if(type==='sessao') dados=dadosBrutos.filter(function(s){
        if(s.professor===currentUser.nome) return true;
        return (s.alunos||'').split(', ').some(function(an){return alunosPermitidos.indexOf(an.trim())>=0;});
      });
      else if(type==='frequencia') dados=dadosBrutos.filter(function(f){return alunosPermitidos.indexOf(f.aluno)>=0;});
      else if(type==='desempenho') dados=dadosBrutos.filter(function(d){return alunosPermitidos.indexOf(d.aluno)>=0;});
    } else if (currentUser.role === 'gestor' || currentUser.role === 'coordenador') {
      // Gestores e Coordenadores veem apenas dados da sua escola
      if (type === 'escola') { // Só a própria escola
        dados = DB.escola.filter(function(e) { return e.nome === currentUser.escola; });
      } else if (['professor', 'turma', 'aluno'].includes(type)) { // Professores, Turmas, Alunos da sua escola
        dados = DB[type].filter(function(item) { return item.escola === currentUser.escola; });
      } else if (['reg-aluno', 'sessao', 'frequencia', 'desempenho'].includes(type)) { // Registros de alunos/professores da sua escola
        dados = DB[type].filter(function(item) {
          if (item.aluno) {
            const aluno = DB.aluno.find(a => a.nome === item.aluno);
            return aluno && aluno.escola === currentUser.escola;
          } else if (item.professor) {
            const professor = DB.professor.find(p => p.nome === item.professor);
            return professor && professor.escola === currentUser.escola;
          }
          return false;
        });
      } else { // Outros tipos (gestor, coordenador) não são incluídos nos relatórios
        dados = [];
      }
    }
  }
  var h=headers[type]||[];
  var k=keys2[type]||[];
  var csv='\uFEFF'+h.join(';')+'\n';
  dados.forEach(function(r){
    csv+=k.map(function(key){
      var v=r[key]||'';
      v=String(v).replace(/;/g,',');
      return '"'+v+'"';
    }).join(';')+'\n';
  });
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='relatorio-'+type+'-aee.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('CSV exportado com sucesso!','tok');
}

// ================================================
// INICIALIZAÇÃO
// ================================================
window.addEventListener('DOMContentLoaded',function(){
  var urlSalva=localStorage.getItem('aee_sheets_url')||'';
  if(urlSalva){
    SHEETS_URL=urlSalva;
    var cfgEl=document.getElementById('cfg-url');
    if(cfgEl) cfgEl.value=urlSalva;
  }
  ['escola','gestor','coordenador','professor','turma','aluno',
   'reg-aluno','sessao','frequencia','desempenho'].forEach(function(t){
    // Não renderiza a tabela de frequência aqui na inicialização
    if (t !== 'frequencia') {
      renderTabela(t);
    }
  });
  atualizarDashboard();
});