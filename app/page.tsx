'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wwmqwbyabgeghlfndgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bXF3YnlhYmdlZ2hsZm5kZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDI5MTcsImV4cCI6MjA5NTAxODkxN30.wC2c5dhFH0dkuJuPP7NTp4wlJeTFHgr9ynK5el0_2S0'
);

const VALOR_PONTO = 4.50;
const AGENDA_LOJA_ID = '972';
const AGENDA_BASE = 'https://agenda.ecocarwash.pt';
const DESCONTO_DIAS = 30;
const DESCONTO_PERCENT = 10;

const HORAS_DISPONIVEIS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00'
];

const ESTADOS = ['Agendado','A Lavar','Lavado','Concluído','Cancelado'];
const ESTADO_CORES: Record<string, string> = {
  'Agendado': '#2563eb', 'A Lavar': '#d97706', 'Lavado': '#7c3aed',
  'Concluído': '#16a34a', 'Cancelado': '#dc2626'
};

function calcularCupao(ordens: any[]) {
  if (!ordens || ordens.length === 0) return null;
  const ultima = ordens[0];
  const dataUltima = new Date(ultima.data_registro);
  const hoje = new Date();
  const diffDias = Math.floor((hoje.getTime() - dataUltima.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias > DESCONTO_DIAS) return null;
  const diasRestantes = DESCONTO_DIAS - diffDias;
  const desconto = (Number(ultima.valor_total) * DESCONTO_PERCENT / 100).toFixed(2);
  const dataExpira = new Date(dataUltima);
  dataExpira.setDate(dataExpira.getDate() + DESCONTO_DIAS);
  return { desconto, diasRestantes, dataExpira: dataExpira.toLocaleDateString('pt-PT') };
}

function gerarCalendario(mesBase: Date) {
  const ano = mesBase.getFullYear();
  const mes = mesBase.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const dias = [];
  for (let i = 0; i < (primeiroDia === 0 ? 6 : primeiroDia - 1); i++) dias.push(null);
  for (let d = 1; d <= diasNoMes; d++) {
    const data = new Date(ano, mes, d);
    dias.push({ dia: d, data, passado: data < hoje, hoje: data.getTime() === hoje.getTime() });
  }
  return dias;
}

export default function Home() {
  const [sessao, setSessao] = useState<any>(null);
  const [vista, setVista] = useState<'dashboard'|'entrada'|'agenda'>('dashboard');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErro, setLoginErro] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [ecrã, setEcrã] = useState<'pesquisa'|'novo'|'cliente'|'calendario'|'hora'|'servico'|'detalhes'|'confirmacao'>('pesquisa');
  const [matricula, setMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [veiculo, setVeiculo] = useState<any>(null);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [servicoSel, setServicoSel] = useState<any>(null);
  const [lavadoresSel, setLavadoresSel] = useState<number[]>([]);
  const [vendedorSel, setVendedorSel] = useState<number|null>(null);
  const [estado, setEstado] = useState('Agendado');
  const [notas, setNotas] = useState('');
  const [dataSel, setDataSel] = useState<Date|null>(null);
  const [horaSel, setHoraSel] = useState('');
  const [mesBase, setMesBase] = useState(new Date());
  const [novoNome, setNovoNome] = useState('');
  const [novoTel, setNovoTel] = useState('');
  const [novoModelo, setNovoModelo] = useState('');
  const [sucesso, setSucesso] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) { carregarDados(); carregarDashboard(); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session) { carregarDados(); carregarDashboard(); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function carregarDashboard() {
    const hoje = new Date().toISOString().split('T')[0];
    const { data: ordensHoje } = await supabase
      .from('ordens_servico')
      .select('valor_total, comissao_individual_paga, funcionarios_alocados')
      .gte('data_registro', `${hoje}T00:00:00`)
      .lte('data_registro', `${hoje}T23:59:59`);
    const { data: rank } = await supabase
      .from('funcionarios').select('*').order('pontos_total', { ascending: false });
    const total = ordensHoje?.length || 0;
    const faturamento = ordensHoje?.reduce((s, o) => s + Number(o.valor_total), 0) || 0;
    const comissao = ordensHoje?.reduce((s, o) => {
      const n = (o.funcionarios_alocados as number[])?.length || 1;
      return s + Number(o.comissao_individual_paga) * n;
    }, 0) || 0;
    setDashboard({ total, faturamento: faturamento.toFixed(2), ticketMedio: total > 0 ? (faturamento/total).toFixed(2) : '0.00', comissao: comissao.toFixed(2) });
    setRanking(rank || []);
  }

  async function fazerLogin() {
    setLoginLoading(true); setLoginErro('');
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) setLoginErro('Email ou password incorrectos');
    setLoginLoading(false);
  }

  async function fazerLogout() { await supabase.auth.signOut(); setSessao(null); }

  async function carregarDados() {
    const { data: f } = await supabase.from('funcionarios').select('*').eq('status','ativo').order('id_interno');
    setFuncionarios(f || []);
    const { data: s } = await supabase.from('servicos').select('*').order('preco');
    setServicos(s || []);
  }

  async function pesquisar() {
    if (!matricula.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.from('veiculos').select('*').eq('matricula', matricula.toUpperCase()).single();
    if (error || !data) { setVeiculo({ matricula: matricula.toUpperCase() }); setEcrã('novo'); }
    else {
      const { data: ord } = await supabase
        .from('ordens_servico').select('*, servicos(nome)')
        .eq('veiculo_id', data.id).order('data_registro', { ascending: false }).limit(5);
      setVeiculo(data); setOrdens(ord || []); setEcrã('cliente');
    }
    setLoading(false);
  }

  async function guardarNovoCliente() {
    if (!novoNome.trim()) return alert('Escreve o nome!');
    const { data, error } = await supabase.from('veiculos').insert({
      matricula: matricula.toUpperCase(), nome_cliente: novoNome,
      telefone_cliente: novoTel, marca_modelo: novoModelo
    }).select().single();
    if (error) return alert('Erro ao guardar!');
    setVeiculo(data); setOrdens([]); setEcrã('cliente');
  }

  function abrirAgendaHoje() {
    const hoje = new Date();
    const dataStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    window.open(`${AGENDA_BASE}/#/appointments?date=${dataStr}`, '_blank');
  }

  function abrirAgendaComDados() {
    if (!servicoSel || !dataSel || !horaSel) return;
    const dataStr = `${dataSel.getFullYear()}-${String(dataSel.getMonth()+1).padStart(2,'0')}-${String(dataSel.getDate()).padStart(2,'0')}`;
    const vendedor = funcionarios.find(f => f.id_interno === vendedorSel);
    const lavadores = funcionarios.filter(f => lavadoresSel.includes(f.id_interno));
    const notasFull = [
      notas,
      vendedor ? `Vendedor: ${vendedor.nome}` : '',
      lavadores.length > 0 ? `Lavadores: ${lavadores.map(f=>f.nome).join(', ')}` : 'Lavadores: A definir',
      `Estado: ${estado}`
    ].filter(Boolean).join(' | ');

    const url = `${AGENDA_BASE}/#/appointments/new/${AGENDA_LOJA_ID}?` +
      `client_name=${encodeURIComponent(veiculo.nome_cliente || '')}` +
      `&client_phone=${encodeURIComponent(veiculo.telefone_cliente || '')}` +
      `&vehicle=${encodeURIComponent(veiculo.matricula || '')}` +
      `&service=${encodeURIComponent(servicoSel.nome || '')}` +
      `&date=${dataStr}` +
      `&time=${encodeURIComponent(horaSel)}` +
      `&notes=${encodeURIComponent(notasFull)}`;
    window.open(url, '_blank');
  }

  async function confirmarLavagem() {
    if (!servicoSel || !dataSel || !horaSel) return alert('Preenche todos os campos!');
    const comissaoTotal = servicoSel.pontos * VALOR_PONTO;
    const nLavadores = lavadoresSel.length || 1;
    const comissaoIndividual = comissaoTotal / nLavadores;
    const pontosIndividuais = servicoSel.pontos / nLavadores;
    const { error } = await supabase.from('ordens_servico').insert({
      veiculo_id: veiculo.id, servico_id: servicoSel.id,
      funcionarios_alocados: lavadoresSel.length > 0 ? lavadoresSel : [],
      valor_total: servicoSel.preco,
      comissao_individual_paga: lavadoresSel.length > 0 ? comissaoIndividual : 0,
      pontos_individuais_ganhos: lavadoresSel.length > 0 ? pontosIndividuais : 0,
    });
    if (error) return alert('Erro ao registar!');
    if (lavadoresSel.length > 0) {
      for (const id of lavadoresSel) {
        await supabase.rpc('incrementar_stats_funcionario', { p_id_interno: id, p_pontos: pontosIndividuais, p_comissao: comissaoIndividual });
      }
    }
    const vendedor = funcionarios.find(f => f.id_interno === vendedorSel);
    const lavadores = funcionarios.filter(f => lavadoresSel.includes(f.id_interno));
    setSucesso({
      servico: servicoSel.nome, valor: servicoSel.preco, pontos: servicoSel.pontos,
      comissaoTotal, comissaoIndividual, nLavadores: lavadoresSel.length,
      lavadores, vendedor, estado, notas, dataSel, horaSel,
      semLavador: lavadoresSel.length === 0
    });
    setEcrã('confirmacao');
    carregarDashboard();
    // Abrir agenda com dados preenchidos
    abrirAgendaComDados();
  }

  function resetar() {
    setEcrã('pesquisa'); setMatricula(''); setVeiculo(null); setOrdens([]);
    setServicoSel(null); setLavadoresSel([]); setVendedorSel(null);
    setEstado('Agendado'); setNotas(''); setDataSel(null); setHoraSel('');
    setNovoNome(''); setNovoTel(''); setNovoModelo(''); setSucesso(null);
    setVista('dashboard');
  }

  const btn = (bg: string, extra?: any) => ({ width: '100%', padding: '12px 0', background: bg, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 10, ...extra });
  const card = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 };
  const inp = { width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' as const, fontSize: 14 };

  if (!sessao) {
    return (
      <div style={{ fontFamily: 'sans-serif', maxWidth: 380, margin: '80px auto', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40 }}>💧</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>AutoWash Pro</h1>
          <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Acesso restrito à equipa</p>
        </div>
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Email</div>
          <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="email@exemplo.com" type="email" style={{ ...inp, marginBottom: 12 }} onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Password</div>
          <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" type="password" style={{ ...inp, marginBottom: 16 }} onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          {loginErro && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 10, textAlign: 'center' }}>{loginErro}</div>}
          <button onClick={fazerLogin} disabled={loginLoading} style={btn('#C4922A')}>{loginLoading ? 'A entrar...' : '🔐 Entrar'}</button>
        </div>
      </div>
    );
  }

  const diasSemana = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto', padding: '0 0 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 8px', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>💧 AutoWash Pro</div>
          <div style={{ fontSize: 11, color: '#888' }}>Sistema de Gestão</div>
        </div>
        <button onClick={fazerLogout} style={{ border: '1px solid #e5e7eb', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#888' }}>Sair</button>
      </div>

      {/* DASHBOARD */}
      {vista === 'dashboard' && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Dashboard · Hoje</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>CARROS HOJE</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard?.total || 0}</div>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>FATURAMENTO</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{dashboard?.faturamento || '0.00'}€</div>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>TICKET MÉDIO</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{dashboard?.ticketMedio || '0.00'}€</div>
            </div>
            <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>COMISSÕES</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>{dashboard?.comissao || '0.00'}€</div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🏆 Ranking da Equipa</div>
          <div style={{ ...card, padding: 12 }}>
            {ranking.map((f, i) => (
              <div key={f.id_interno} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < ranking.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ width: 24, textAlign: 'center', fontSize: 14 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}</div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#C4922A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{f.nome.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.nome}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{f.carros_total} carros</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C4922A' }}>{f.pontos_total} pts</div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>{f.comissao_total}€</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setVista('entrada'); setEcrã('pesquisa'); }} style={btn('#C4922A')}>🚗 Nova Entrada</button>
        </div>
      )}

      {/* AGENDA */}
      {vista === 'agenda' && (
        <div style={{ padding: '0 16px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📅 Agenda EcoCarWash</div>
          <div style={{ ...card, padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Agenda Interna</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Clica para abrir em nova janela</div>
            <a href={`${AGENDA_BASE}/#/dashboard`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', width: '100%', padding: '14px 0', background: '#C4922A', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' as const }}>
              🗓️ Abrir Agenda
            </a>
          </div>
        </div>
      )}

      {/* NOVA ENTRADA */}
      {vista === 'entrada' && (
        <div style={{ padding: '0 16px' }}>
          <button onClick={() => setVista('dashboard')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>← Dashboard</button>

          {/* PESQUISA */}
          {ecrã === 'pesquisa' && (
            <div>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Matrícula</div>
              <input value={matricula} onChange={e => setMatricula(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && pesquisar()} placeholder="AA-00-AA" maxLength={8}
                style={{ display: 'block', width: '100%', fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: 6, padding: '12px 0', border: '2px solid #e5e7eb', borderRadius: 12, marginTop: 6, outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={pesquisar} disabled={loading} style={btn('#C4922A')}>{loading ? 'A pesquisar...' : '🔍 Pesquisar'}</button>
            </div>
          )}

          {/* NOVO CLIENTE */}
          {ecrã === 'novo' && (
            <div style={{ ...card, background: '#fffbeb', borderColor: '#fcd34d' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Matrícula não encontrada</div>
              <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>{matricula.toUpperCase()} · Novo cliente</div>
              <input placeholder="Nome completo *" value={novoNome} onChange={e => setNovoNome(e.target.value)} style={inp} />
              <input placeholder="Telefone / WhatsApp" value={novoTel} onChange={e => setNovoTel(e.target.value)} style={inp} />
              <input placeholder="Marca / Modelo" value={novoModelo} onChange={e => setNovoModelo(e.target.value)} style={inp} />
              <button onClick={guardarNovoCliente} style={btn('#C4922A')}>Guardar e Continuar →</button>
              <button onClick={() => setEcrã('pesquisa')} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
            </div>
          )}

          {/* FICHA CLIENTE */}
          {ecrã === 'cliente' && veiculo && (() => {
            const cupao = calcularCupao(ordens);
            return (
              <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#C4922A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{veiculo.nome_cliente?.charAt(0) || '?'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{veiculo.nome_cliente}</div>
                    <div style={{ color: '#666', fontSize: 13 }}>{veiculo.telefone_cliente}</div>
                  </div>
                  <div style={{ background: '#C4922A', color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{ordens.length} visitas</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: '#fff', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 11, color: '#888' }}>Matrícula</div>
                    <div style={{ fontWeight: 700, letterSpacing: 2 }}>{veiculo.matricula}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 11, color: '#888' }}>Viatura</div>
                    <div style={{ fontWeight: 600 }}>{veiculo.marca_modelo || '—'}</div>
                  </div>
                </div>
                {cupao && (
                  <div style={{ background: '#fefce8', border: '1.5px dashed #facc15', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>🎟️</span>
                      <span style={{ fontWeight: 700, color: '#854d0e', fontSize: 14 }}>Cupão Activo!</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#713f12', marginBottom: 4 }}>Desconto de <strong style={{ color: '#16a34a' }}>{cupao.desconto}€</strong></div>
                    <div style={{ fontSize: 11, color: '#92400e' }}>⏰ Válido até {cupao.dataExpira} · {cupao.diasRestantes} dias</div>
                  </div>
                )}
                {ordens.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>ÚLTIMAS LAVAGENS</div>
                    {ordens.slice(0,3).map((o,i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #e5e7eb' }}>
                        <span>{o.servicos?.nome || 'Serviço'}</span>
                        <span style={{ fontWeight: 600 }}>{o.valor_total}€</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => { abrirAgendaHoje(); setEcrã('calendario'); }} style={btn('#2563eb')}>📅 Ver Disponibilidade → Agendar</button>
                <button onClick={() => setEcrã('pesquisa')} style={{ ...btn('#888'), marginTop: 6 }}>← Nova Pesquisa</button>
              </div>
            );
          })()}

          {/* CALENDÁRIO */}
          {ecrã === 'calendario' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📅 Escolhe o dia</div>
              <div style={{ ...card, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <button onClick={() => setMesBase(new Date(mesBase.getFullYear(), mesBase.getMonth()-1, 1))}
                    style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>‹</button>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {mesBase.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                  </div>
                  <button onClick={() => setMesBase(new Date(mesBase.getFullYear(), mesBase.getMonth()+1, 1))}
                    style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                  {diasSemana.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#888', fontWeight: 600, padding: '4px 0' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                  {gerarCalendario(mesBase).map((item, i) => (
                    <div key={i}
                      onClick={() => { if (item && !item.passado) setDataSel(item.data); }}
                      style={{
                        textAlign: 'center', padding: '6px 2px', borderRadius: 6, fontSize: 13, cursor: item && !item.passado ? 'pointer' : 'default',
                        background: item && dataSel && item.data.toDateString() === dataSel.toDateString() ? '#C4922A' : item?.hoje ? '#fffbeb' : 'transparent',
                        color: item && dataSel && item.data.toDateString() === dataSel.toDateString() ? '#fff' : item?.passado ? '#d1d5db' : item?.hoje ? '#C4922A' : '#374151',
                        fontWeight: item?.hoje || (item && dataSel && item.data.toDateString() === dataSel.toDateString()) ? 700 : 400,
                        border: item?.hoje && !(dataSel && item.data.toDateString() === dataSel.toDateString()) ? '1px solid #C4922A' : '1px solid transparent'
                      }}>
                      {item ? item.dia : ''}
                    </div>
                  ))}
                </div>
              </div>
              {dataSel && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 10, marginBottom: 10, fontSize: 13, textAlign: 'center' }}>
                  ✅ <strong>{dataSel.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                </div>
              )}
              <button onClick={() => dataSel && setEcrã('hora')} style={btn(dataSel ? '#C4922A' : '#ccc')}>Escolher Hora →</button>
              <button onClick={() => setEcrã('cliente')} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
            </div>
          )}

          {/* HORA */}
          {ecrã === 'hora' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🕐 Escolhe a hora</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                {dataSel?.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {HORAS_DISPONIVEIS.map(h => (
                  <div key={h} onClick={() => setHoraSel(h)}
                    style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 8, border: `1.5px solid ${horaSel === h ? '#C4922A' : '#e5e7eb'}`, background: horaSel === h ? '#fffbeb' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: horaSel === h ? 700 : 400, color: horaSel === h ? '#C4922A' : '#374151' }}>
                    {h}
                  </div>
                ))}
              </div>
              <button onClick={() => horaSel && setEcrã('servico')} style={btn(horaSel ? '#C4922A' : '#ccc')}>Escolher Serviço →</button>
              <button onClick={() => setEcrã('calendario')} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
            </div>
          )}

          {/* SERVIÇO */}
          {ecrã === 'servico' && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Escolhe o serviço:</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                {dataSel?.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })} às {horaSel}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {servicos.map(s => (
                  <div key={s.id} onClick={() => setServicoSel(s)}
                    style={{ ...card, cursor: 'pointer', marginBottom: 0, borderColor: servicoSel?.id === s.id ? '#C4922A' : '#e5e7eb', background: servicoSel?.id === s.id ? '#fffbeb' : '#fff' }}>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{s.preco}€</div>
                    <div style={{ fontSize: 13, color: '#444' }}>{s.nome}</div>
                    <div style={{ fontSize: 11, color: '#C4922A', marginTop: 4 }}>⭐ {s.pontos} pts · {(s.pontos * VALOR_PONTO).toFixed(2)}€</div>
                  </div>
                ))}
              </div>
              <button onClick={() => servicoSel && setEcrã('detalhes')} style={btn(servicoSel ? '#C4922A' : '#ccc')}>Continuar →</button>
              <button onClick={() => setEcrã('hora')} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
            </div>
          )}

          {/* DETALHES — vendedor, lavadores, estado, notas */}
          {ecrã === 'detalhes' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Detalhes do agendamento</div>

              {/* VENDEDOR */}
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Vendedor *</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {funcionarios.map(f => (
                  <div key={f.id_interno} onClick={() => setVendedorSel(vendedorSel === f.id_interno ? null : f.id_interno)}
                    style={{ padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${vendedorSel === f.id_interno ? '#2563eb' : '#e5e7eb'}`, background: vendedorSel === f.id_interno ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: vendedorSel === f.id_interno ? 700 : 400, color: vendedorSel === f.id_interno ? '#2563eb' : '#444' }}>
                    {f.id_interno}. {f.nome}
                  </div>
                ))}
              </div>

              {/* LAVADORES */}
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Lavadores (pode deixar vazio)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {funcionarios.map(f => (
                  <div key={f.id_interno} onClick={() => {
                    setLavadoresSel(prev => prev.includes(f.id_interno) ? prev.filter(x => x !== f.id_interno) : [...prev, f.id_interno]);
                  }}
                    style={{ padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${lavadoresSel.includes(f.id_interno) ? '#C4922A' : '#e5e7eb'}`, background: lavadoresSel.includes(f.id_interno) ? '#fffbeb' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: lavadoresSel.includes(f.id_interno) ? 700 : 400, color: lavadoresSel.includes(f.id_interno) ? '#C4922A' : '#444' }}>
                    {f.id_interno}. {f.nome}
                  </div>
                ))}
                <div onClick={() => setLavadoresSel([])}
                  style={{ padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${lavadoresSel.length === 0 ? '#2563eb' : '#e5e7eb'}`, background: lavadoresSel.length === 0 ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 13, color: lavadoresSel.length === 0 ? '#2563eb' : '#888' }}>
                  ⏳ A definir
                </div>
              </div>

              {/* ESTADO */}
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Estado</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {ESTADOS.map(e => (
                  <div key={e} onClick={() => setEstado(e)}
                    style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${estado === e ? ESTADO_CORES[e] : '#e5e7eb'}`, background: estado === e ? ESTADO_CORES[e] : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: estado === e ? 700 : 400, color: estado === e ? '#fff' : '#444' }}>
                    {e}
                  </div>
                ))}
              </div>

              {/* NOTAS */}
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Notas adicionais</div>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Pedidos especiais, observações..." rows={3}
                style={{ ...inp, resize: 'none', fontFamily: 'sans-serif' }} />

              {/* RESUMO */}
              {servicoSel && (
                <div style={{ background: '#fffbeb', border: '1px solid #C4922A', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>📋 Resumo</div>
                  <div style={{ color: '#666' }}>{dataSel?.toLocaleDateString('pt-PT')} às {horaSel}</div>
                  <div style={{ color: '#666' }}>{servicoSel.nome} · {servicoSel.preco}€</div>
                  {lavadoresSel.length > 0 && (
                    <div style={{ color: '#C4922A', fontWeight: 600 }}>
                      Comissão: {(servicoSel.pontos * VALOR_PONTO).toFixed(2)}€ ÷ {lavadoresSel.length} = {(servicoSel.pontos * VALOR_PONTO / lavadoresSel.length).toFixed(2)}€/pessoa
                    </div>
                  )}
                </div>
              )}

              <button onClick={confirmarLavagem} style={btn('#16a34a')}>✅ Confirmar → Registar na Agenda</button>
              <button onClick={() => setEcrã('servico')} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
            </div>
          )}

          {/* CONFIRMAÇÃO */}
          {ecrã === 'confirmacao' && sucesso && (
            <div>
              {/* HEADER ESTILO AGENDA */}
              <div style={{ background: ESTADO_CORES[sucesso.estado] || '#16a34a', borderRadius: 12, padding: 16, marginBottom: 12, color: '#fff', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Agendamento Registado!</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                  {sucesso.dataSel?.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} às {sucesso.horaSel}
                </div>
                <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 12px', display: 'inline-block', fontSize: 12, fontWeight: 600 }}>
                  {sucesso.estado}
                </div>
              </div>

              {/* DADOS ESTILO AGENDA */}
              <div style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#C4922A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{veiculo?.nome_cliente?.charAt(0) || '?'}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{veiculo?.nome_cliente}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{veiculo?.telefone_cliente} · {veiculo?.matricula}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: '#888' }}>Serviço</span><span style={{ fontWeight: 600 }}>{sucesso.servico}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: '#888' }}>Valor</span><span style={{ fontWeight: 600 }}>{sucesso.valor}€</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: '#888' }}>Viatura</span><span style={{ fontWeight: 600 }}>{veiculo?.marca_modelo || '—'}</span></div>
                  {sucesso.vendedor && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: '#888' }}>Vendedor</span><span style={{ fontWeight: 600, color: '#2563eb' }}>{sucesso.vendedor.nome}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#888' }}>Lavadores</span>
                    <span style={{ fontWeight: 600 }}>{sucesso.lavadores.length > 0 ? sucesso.lavadores.map((f:any) => f.nome).join(', ') : '⏳ A definir'}</span>
                  </div>
                  {sucesso.lavadores.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#888' }}>Comissão/pessoa</span>
                      <span style={{ fontWeight: 600, color: '#16a34a' }}>{sucesso.comissaoIndividual.toFixed(2)}€</span>
                    </div>
                  )}
                  {sucesso.notas && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: '#888' }}>Notas</span><span style={{ fontWeight: 600, maxWidth: '60%', textAlign: 'right' }}>{sucesso.notas}</span></div>}
                </div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12, color: '#1d4ed8', textAlign: 'center' }}>
                📅 A agenda foi aberta automaticamente com os dados preenchidos
              </div>

              <button onClick={resetar} style={btn('#C4922A')}>➕ Nova Entrada</button>
            </div>
          )}
        </div>
      )}

      {/* BARRA INFERIOR */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', padding: '8px 0' }}>
        <button onClick={() => setVista('dashboard')} style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', padding: '6px 0', fontSize: 11, color: vista === 'dashboard' ? '#C4922A' : '#888', fontWeight: vista === 'dashboard' ? 700 : 400 }}>
          📊<br/>Dashboard
        </button>
        <button onClick={() => setVista('agenda')} style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', padding: '6px 0', fontSize: 11, color: vista === 'agenda' ? '#C4922A' : '#888', fontWeight: vista === 'agenda' ? 700 : 400 }}>
          📅<br/>Agenda
        </button>
        <button onClick={() => { setVista('entrada'); setEcrã('pesquisa'); }} style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', padding: '6px 0', fontSize: 11, color: vista === 'entrada' ? '#C4922A' : '#888', fontWeight: vista === 'entrada' ? 700 : 400 }}>
          🚗<br/>Nova Entrada
        </button>
      </div>
    </div>
  );
}
