'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wwmqwbyabgeghlfndgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bXF3YnlhYmdlZ2hsZm5kZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDI5MTcsImV4cCI6MjA5NTAxODkxN30.wC2c5dhFH0dkuJuPP7NTp4wlJeTFHgr9ynK5el0_2S0'
);

const VALOR_PONTO = 4.50;
const AGENDA_URL = 'https://agenda.ecocarwash.pt/#/dashboard';
const AGENDA_NOVA = 'https://agenda.ecocarwash.pt/#/appointments/new/972';
const DESCONTO_DIAS = 30;
const DESCONTO_PERCENT = 10;

const HORAS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00'
];

const ESTADOS = ['Agendado','A Lavar','Lavado','Concluído','Cancelado'];
const ESTADO_COR: Record<string,string> = {
  'Agendado':'#2563eb','A Lavar':'#d97706','Lavado':'#7c3aed',
  'Concluído':'#16a34a','Cancelado':'#dc2626'
};

function calcularCupao(ordens: any[]) {
  if (!ordens?.length) return null;
  const ultima = ordens[0];
  const diff = Math.floor((Date.now() - new Date(ultima.data_registro).getTime()) / 86400000);
  if (diff > DESCONTO_DIAS) return null;
  const expira = new Date(ultima.data_registro);
  expira.setDate(expira.getDate() + DESCONTO_DIAS);
  return {
    desconto: (Number(ultima.valor_total) * DESCONTO_PERCENT / 100).toFixed(2),
    diasRestantes: DESCONTO_DIAS - diff,
    dataExpira: expira.toLocaleDateString('pt-PT')
  };
}

function gerarCalendario(base: Date) {
  const ano = base.getFullYear(), mes = base.getMonth();
  const primeiro = new Date(ano, mes, 1).getDay();
  const total = new Date(ano, mes+1, 0).getDate();
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dias: any[] = [];
  for (let i = 0; i < (primeiro === 0 ? 6 : primeiro-1); i++) dias.push(null);
  for (let d = 1; d <= total; d++) {
    const data = new Date(ano, mes, d);
    dias.push({ dia: d, data, passado: data < hoje, hoje: data.getTime() === hoje.getTime() });
  }
  return dias;
}

function BotaoCopiar({ label, texto }: { label: string, texto: string }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 6 }}>
      <div>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 2 }}>{texto}</div>
      </div>
      <button onClick={copiar}
        style={{ border: 'none', background: copiado ? '#16a34a' : '#2563eb', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
        {copiado ? '✅' : '📋'}
      </button>
    </div>
  );
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessao(session);
      if (session) { carregarDados(); carregarDashboard(); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function carregarDashboard() {
    const hoje = new Date().toISOString().split('T')[0];
    const { data: o } = await supabase.from('ordens_servico')
      .select('valor_total,comissao_individual_paga,funcionarios_alocados')
      .gte('data_registro',`${hoje}T00:00:00`).lte('data_registro',`${hoje}T23:59:59`);
    const { data: r } = await supabase.from('funcionarios').select('*').order('pontos_total',{ascending:false});
    const total = o?.length||0;
    const fat = o?.reduce((s,x)=>s+Number(x.valor_total),0)||0;
    const com = o?.reduce((s,x)=>s+Number(x.comissao_individual_paga)*((x.funcionarios_alocados as number[])?.length||1),0)||0;
    setDashboard({total, faturamento:fat.toFixed(2), ticketMedio:total>0?(fat/total).toFixed(2):'0.00', comissao:com.toFixed(2)});
    setRanking(r||[]);
  }

  async function fazerLogin() {
    setLoginLoading(true); setLoginErro('');
    const {error} = await supabase.auth.signInWithPassword({email:loginEmail,password:loginPassword});
    if (error) setLoginErro('Email ou password incorrectos');
    setLoginLoading(false);
  }

  async function fazerLogout() { await supabase.auth.signOut(); setSessao(null); }

  async function carregarDados() {
    const {data:f} = await supabase.from('funcionarios').select('*').eq('status','ativo').order('id_interno');
    setFuncionarios(f||[]);
    const {data:s} = await supabase.from('servicos').select('*').order('preco');
    setServicos(s||[]);
  }

  async function pesquisar() {
    if (!matricula.trim()) return;
    setLoading(true);
    const {data,error} = await supabase.from('veiculos').select('*').eq('matricula',matricula.toUpperCase()).single();
    if (error||!data) { setVeiculo({matricula:matricula.toUpperCase()}); setEcrã('novo'); }
    else {
      const {data:ord} = await supabase.from('ordens_servico').select('*,servicos(nome)').eq('veiculo_id',data.id).order('data_registro',{ascending:false}).limit(5);
      setVeiculo(data); setOrdens(ord||[]); setEcrã('cliente');
    }
    setLoading(false);
  }

  async function guardarNovoCliente() {
    if (!novoNome.trim()) return alert('Escreve o nome!');
    const {data,error} = await supabase.from('veiculos').insert({
      matricula:matricula.toUpperCase(), nome_cliente:novoNome, telefone_cliente:novoTel, marca_modelo:novoModelo
    }).select().single();
    if (error) return alert('Erro!');
    setVeiculo(data); setOrdens([]); setEcrã('cliente');
  }

  async function confirmarLavagem() {
    if (!servicoSel||!dataSel||!horaSel) return alert('Preenche todos os campos!');
    const ct = servicoSel.pontos*VALOR_PONTO;
    const n = lavadoresSel.length||1;
    const ci = ct/n, pi = servicoSel.pontos/n;
    const {error} = await supabase.from('ordens_servico').insert({
      veiculo_id:veiculo.id, servico_id:servicoSel.id,
      funcionarios_alocados:lavadoresSel.length>0?lavadoresSel:[],
      valor_total:servicoSel.preco,
      comissao_individual_paga:lavadoresSel.length>0?ci:0,
      pontos_individuais_ganhos:lavadoresSel.length>0?pi:0,
    });
    if (error) return alert('Erro ao registar!');
    if (lavadoresSel.length>0) {
      for (const id of lavadoresSel)
        await supabase.rpc('incrementar_stats_funcionario',{p_id_interno:id,p_pontos:pi,p_comissao:ci});
    }
    const vendedor = funcionarios.find(f=>f.id_interno===vendedorSel);
    const lavadores = funcionarios.filter(f=>lavadoresSel.includes(f.id_interno));
    setSucesso({servico:servicoSel.nome, valor:servicoSel.preco, pontos:servicoSel.pontos,
      comissaoTotal:ct, comissaoIndividual:ci, nLavadores:lavadoresSel.length,
      lavadores, vendedor, estado, notas, dataSel, horaSel});
    setEcrã('confirmacao');
    carregarDashboard();
  }

  function resetar() {
    setEcrã('pesquisa'); setMatricula(''); setVeiculo(null); setOrdens([]);
    setServicoSel(null); setLavadoresSel([]); setVendedorSel(null);
    setEstado('Agendado'); setNotas(''); setDataSel(null); setHoraSel('');
    setNovoNome(''); setNovoTel(''); setNovoModelo(''); setSucesso(null);
    setVista('dashboard');
  }

  const btn = (bg:string) => ({width:'100%',padding:'12px 0',background:bg,color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginTop:10});
  const card = {border:'1px solid #e5e7eb',borderRadius:12,padding:16,marginBottom:12};
  const inp = {width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:8,marginBottom:8,boxSizing:'border-box' as const,fontSize:14};
  const dias7 = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  if (!sessao) return (
    <div style={{fontFamily:'sans-serif',maxWidth:380,margin:'80px auto',padding:24}}>
      <div style={{textAlign:'center',marginBottom:32}}>
        <div style={{fontSize:40}}>💧</div>
        <h1 style={{fontSize:22,fontWeight:700,margin:'8px 0 4px'}}>AutoWash Pro</h1>
        <p style={{color:'#888',fontSize:13,margin:0}}>Acesso restrito à equipa</p>
      </div>
      <div style={{...card,padding:24}}>
        <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Email</div>
        <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="email@exemplo.com" type="email" style={{...inp,marginBottom:12}} onKeyDown={e=>e.key==='Enter'&&fazerLogin()}/>
        <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Password</div>
        <input value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••" type="password" style={{...inp,marginBottom:16}} onKeyDown={e=>e.key==='Enter'&&fazerLogin()}/>
        {loginErro&&<div style={{color:'#dc2626',fontSize:13,marginBottom:10,textAlign:'center'}}>{loginErro}</div>}
        <button onClick={fazerLogin} disabled={loginLoading} style={btn('#C4922A')}>{loginLoading?'A entrar...':'🔐 Entrar'}</button>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:'sans-serif',maxWidth:480,margin:'0 auto',padding:'0 0 80px'}}>
      <div style={{display:'flex',alignItems:'center',padding:'16px 16px 8px',borderBottom:'1px solid #e5e7eb',marginBottom:16}}>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:700}}>💧 AutoWash Pro</div>
          <div style={{fontSize:11,color:'#888'}}>Sistema de Gestão</div>
        </div>
        <button onClick={fazerLogout} style={{border:'1px solid #e5e7eb',background:'transparent',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',color:'#888'}}>Sair</button>
      </div>

      {vista==='dashboard'&&(
        <div style={{padding:'0 16px'}}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>Dashboard · Hoje</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
            {[
              {label:'CARROS HOJE',val:dashboard?.total||0,cor:'#fffbeb',bor:'#fcd34d',valCor:'#374151',big:true},
              {label:'FATURAMENTO',val:`${dashboard?.faturamento||'0.00'}€`,cor:'#f0fdf4',bor:'#86efac',valCor:'#16a34a'},
              {label:'TICKET MÉDIO',val:`${dashboard?.ticketMedio||'0.00'}€`,cor:'#eff6ff',bor:'#bfdbfe',valCor:'#2563eb'},
              {label:'COMISSÕES',val:`${dashboard?.comissao||'0.00'}€`,cor:'#fdf4ff',bor:'#e9d5ff',valCor:'#7c3aed'},
            ].map(m=>(
              <div key={m.label} style={{background:m.cor,border:`1px solid ${m.bor}`,borderRadius:12,padding:14}}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>{m.label}</div>
                <div style={{fontSize:m.big?28:24,fontWeight:700,color:m.valCor}}>{m.val}</div>
              </div>
            ))}
          </div>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>🏆 Ranking da Equipa</div>
          <div style={{...card,padding:12}}>
            {ranking.map((f,i)=>(
              <div key={f.id_interno} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<ranking.length-1?'1px solid #f3f4f6':'none'}}>
                <div style={{width:24,textAlign:'center',fontSize:14}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</div>
                <div style={{width:32,height:32,borderRadius:'50%',background:'#C4922A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{f.nome.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{f.nome}</div>
                  <div style={{fontSize:11,color:'#888'}}>{f.carros_total} carros</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#C4922A'}}>{f.pontos_total} pts</div>
                  <div style={{fontSize:11,color:'#16a34a'}}>{f.comissao_total}€</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>{setVista('entrada');setEcrã('pesquisa');}} style={btn('#C4922A')}>🚗 Nova Entrada</button>
        </div>
      )}

      {vista==='agenda'&&(
        <div style={{padding:'0 16px',textAlign:'center'}}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>📅 Agenda EcoCarWash</div>
          <div style={{...card,padding:24}}>
            <div style={{fontSize:48,marginBottom:12}}>📅</div>
            <div style={{fontWeight:600,marginBottom:8}}>Agenda Interna</div>
            <div style={{color:'#888',fontSize:13,marginBottom:20}}>Clica para abrir em nova janela</div>
            <a href={AGENDA_URL} target="_blank" rel="noopener noreferrer"
              style={{display:'block',width:'100%',padding:'14px 0',background:'#C4922A',color:'#fff',borderRadius:12,fontSize:15,fontWeight:600,textDecoration:'none',boxSizing:'border-box' as const}}>
              🗓️ Abrir Agenda
            </a>
          </div>
        </div>
      )}

      {vista==='entrada'&&(
        <div style={{padding:'0 16px'}}>
          <button onClick={()=>setVista('dashboard')} style={{background:'none',border:'none',color:'#888',cursor:'pointer',fontSize:13,marginBottom:12}}>← Dashboard</button>

          {ecrã==='pesquisa'&&(
            <div>
              <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>Matrícula</div>
              <input value={matricula} onChange={e=>setMatricula(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&pesquisar()} placeholder="AA-00-AA" maxLength={8}
                style={{display:'block',width:'100%',fontSize:28,fontWeight:700,textAlign:'center',letterSpacing:6,padding:'12px 0',border:'2px solid #e5e7eb',borderRadius:12,marginTop:6,outline:'none',boxSizing:'border-box'}}/>
              <button onClick={pesquisar} disabled={loading} style={btn('#C4922A')}>{loading?'A pesquisar...':'🔍 Pesquisar'}</button>
            </div>
          )}

          {ecrã==='novo'&&(
            <div style={{...card,background:'#fffbeb',borderColor:'#fcd34d'}}>
              <div style={{fontWeight:700,marginBottom:4}}>⚠️ Matrícula não encontrada</div>
              <div style={{color:'#666',fontSize:13,marginBottom:12}}>{matricula.toUpperCase()} · Novo cliente</div>
              <input placeholder="Nome completo *" value={novoNome} onChange={e=>setNovoNome(e.target.value)} style={inp}/>
              <input placeholder="Telefone / WhatsApp" value={novoTel} onChange={e=>setNovoTel(e.target.value)} style={inp}/>
              <input placeholder="Marca / Modelo" value={novoModelo} onChange={e=>setNovoModelo(e.target.value)} style={inp}/>
              <button onClick={guardarNovoCliente} style={btn('#C4922A')}>Guardar e Continuar →</button>
              <button onClick={()=>setEcrã('pesquisa')} style={{...btn('#888'),marginTop:6}}>← Voltar</button>
            </div>
          )}

          {ecrã==='cliente'&&veiculo&&(()=>{
            const cupao = calcularCupao(ordens);
            return (
              <div style={{...card,background:'#f0fdf4',borderColor:'#86efac'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:'#C4922A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700}}>{veiculo.nome_cliente?.charAt(0)||'?'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:16}}>{veiculo.nome_cliente}</div>
                    <div style={{color:'#666',fontSize:13}}>{veiculo.telefone_cliente}</div>
                  </div>
                  <div style={{background:'#C4922A',color:'#fff',fontSize:11,padding:'2px 10px',borderRadius:20,fontWeight:600}}>{ordens.length} visitas</div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  <div style={{background:'#fff',borderRadius:8,padding:'8px 12px'}}>
                    <div style={{fontSize:11,color:'#888'}}>Matrícula</div>
                    <div style={{fontWeight:700,letterSpacing:2}}>{veiculo.matricula}</div>
                  </div>
                  <div style={{background:'#fff',borderRadius:8,padding:'8px 12px'}}>
                    <div style={{fontSize:11,color:'#888'}}>Viatura</div>
                    <div style={{fontWeight:600}}>{veiculo.marca_modelo||'—'}</div>
                  </div>
                </div>
                {cupao&&(
                  <div style={{background:'#fefce8',border:'1.5px dashed #facc15',borderRadius:10,padding:12,marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:20}}>🎟️</span>
                      <span style={{fontWeight:700,color:'#854d0e',fontSize:14}}>Cupão Activo!</span>
                    </div>
                    <div style={{fontSize:13,color:'#713f12',marginBottom:4}}>Desconto de <strong style={{color:'#16a34a'}}>{cupao.desconto}€</strong></div>
                    <div style={{fontSize:11,color:'#92400e'}}>⏰ Válido até {cupao.dataExpira} · {cupao.diasRestantes} dias</div>
                  </div>
                )}
                {ordens.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:'#888',marginBottom:6}}>ÚLTIMAS LAVAGENS</div>
                    {ordens.slice(0,3).map((o,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'4px 0',borderBottom:'1px solid #e5e7eb'}}>
                        <span>{o.servicos?.nome||'Serviço'}</span>
                        <span style={{fontWeight:600}}>{o.valor_total}€</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={()=>setEcrã('calendario')} style={btn('#C4922A')}>📅 Agendar Lavagem →</button>
                <button onClick={()=>setEcrã('pesquisa')} style={{...btn('#888'),marginTop:6}}>← Nova Pesquisa</button>
              </div>
            );
          })()}

          {ecrã==='calendario'&&(
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>📅 Escolhe o dia</div>
              <div style={{...card,padding:12}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <button onClick={()=>setMesBase(new Date(mesBase.getFullYear(),mesBase.getMonth()-1,1))}
                    style={{border:'1px solid #e5e7eb',background:'#fff',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:16}}>‹</button>
                  <div style={{fontWeight:600,fontSize:14}}>{mesBase.toLocaleDateString('pt-PT',{month:'long',year:'numeric'})}</div>
                  <button onClick={()=>setMesBase(new Date(mesBase.getFullYear(),mesBase.getMonth()+1,1))}
                    style={{border:'1px solid #e5e7eb',background:'#fff',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:16}}>›</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
                  {dias7.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'#888',fontWeight:600,padding:'4px 0'}}>{d}</div>)}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                  {gerarCalendario(mesBase).map((item,i)=>(
                    <div key={i} onClick={()=>{if(item&&!item.passado)setDataSel(item.data);}}
                      style={{
                        textAlign:'center',padding:'6px 2px',borderRadius:6,fontSize:13,
                        cursor:item&&!item.passado?'pointer':'default',
                        background:item&&dataSel&&item.data.toDateString()===dataSel.toDateString()?'#C4922A':item?.hoje?'#fffbeb':'transparent',
                        color:item&&dataSel&&item.data.toDateString()===dataSel.toDateString()?'#fff':item?.passado?'#d1d5db':item?.hoje?'#C4922A':'#374151',
                        fontWeight:item?.hoje||(item&&dataSel&&item.data.toDateString()===dataSel.toDateString())?700:400,
                        border:item?.hoje&&!(dataSel&&item.data.toDateString()===dataSel.toDateString())?'1px solid #C4922A':'1px solid transparent'
                      }}>
                      {item?item.dia:''}
                    </div>
                  ))}
                </div>
              </div>
              {dataSel&&(
                <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,padding:10,marginBottom:10,fontSize:13,textAlign:'center'}}>
                  ✅ <strong>{dataSel.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'})}</strong>
                </div>
              )}
              <button onClick={()=>dataSel&&setEcrã('hora')} style={btn(dataSel?'#C4922A':'#ccc')}>Escolher Hora →</button>
              <button onClick={()=>setEcrã('cliente')} style={{...btn('#888'),marginTop:6}}>← Voltar</button>
            </div>
          )}

          {ecrã==='hora'&&(
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>🕐 Escolhe a hora</div>
              <div style={{fontSize:12,color:'#888',marginBottom:12}}>{dataSel?.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'})}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
                {HORAS.map(h=>(
                  <div key={h} onClick={()=>setHoraSel(h)}
                    style={{textAlign:'center',padding:'10px 4px',borderRadius:8,border:`1.5px solid ${horaSel===h?'#C4922A':'#e5e7eb'}`,background:horaSel===h?'#fffbeb':'#fff',cursor:'pointer',fontSize:13,fontWeight:horaSel===h?700:400,color:horaSel===h?'#C4922A':'#374151'}}>
                    {h}
                  </div>
                ))}
              </div>
              <button onClick={()=>horaSel&&setEcrã('servico')} style={btn(horaSel?'#C4922A':'#ccc')}>Escolher Serviço →</button>
              <button onClick={()=>setEcrã('calendario')} style={{...btn('#888'),marginTop:6}}>← Voltar</button>
            </div>
          )}

          {ecrã==='servico'&&(
            <div>
              <div style={{fontWeight:700,marginBottom:4}}>Escolhe o serviço:</div>
              <div style={{fontSize:12,color:'#888',marginBottom:12}}>{dataSel?.toLocaleDateString('pt-PT',{day:'numeric',month:'long'})} às {horaSel}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                {servicos.map(s=>(
                  <div key={s.id} onClick={()=>setServicoSel(s)}
                    style={{...card,cursor:'pointer',marginBottom:0,borderColor:servicoSel?.id===s.id?'#C4922A':'#e5e7eb',background:servicoSel?.id===s.id?'#fffbeb':'#fff'}}>
                    <div style={{fontWeight:700,fontSize:20}}>{s.preco}€</div>
                    <div style={{fontSize:13,color:'#444'}}>{s.nome}</div>
                    <div style={{fontSize:11,color:'#C4922A',marginTop:4}}>⭐ {s.pontos} pts · {(s.pontos*VALOR_PONTO).toFixed(2)}€</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>servicoSel&&setEcrã('detalhes')} style={btn(servicoSel?'#C4922A':'#ccc')}>Continuar →</button>
              <button onClick={()=>setEcrã('hora')} style={{...btn('#888'),marginTop:6}}>← Voltar</button>
            </div>
          )}

          {ecrã==='detalhes'&&(
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Detalhes do agendamento</div>

              <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Vendedor *</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                {funcionarios.map(f=>(
                  <div key={f.id_interno} onClick={()=>setVendedorSel(vendedorSel===f.id_interno?null:f.id_interno)}
                    style={{padding:'8px 14px',borderRadius:20,border:`1.5px solid ${vendedorSel===f.id_interno?'#2563eb':'#e5e7eb'}`,background:vendedorSel===f.id_interno?'#eff6ff':'#fff',cursor:'pointer',fontSize:13,fontWeight:vendedorSel===f.id_interno?700:400,color:vendedorSel===f.id_interno?'#2563eb':'#444'}}>
                    {f.id_interno}. {f.nome}
                  </div>
                ))}
              </div>

              <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Lavadores (opcional)</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                {funcionarios.map(f=>(
                  <div key={f.id_interno} onClick={()=>setLavadoresSel(prev=>prev.includes(f.id_interno)?prev.filter(x=>x!==f.id_interno):[...prev,f.id_interno])}
                    style={{padding:'8px 14px',borderRadius:20,border:`1.5px solid ${lavadoresSel.includes(f.id_interno)?'#C4922A':'#e5e7eb'}`,background:lavadoresSel.includes(f.id_interno)?'#fffbeb':'#fff',cursor:'pointer',fontSize:13,fontWeight:lavadoresSel.includes(f.id_interno)?700:400,color:lavadoresSel.includes(f.id_interno)?'#C4922A':'#444'}}>
                    {f.id_interno}. {f.nome}
                  </div>
                ))}
                <div onClick={()=>setLavadoresSel([])}
                  style={{padding:'8px 14px',borderRadius:20,border:`1.5px solid ${lavadoresSel.length===0?'#888':'#e5e7eb'}`,background:lavadoresSel.length===0?'#f9fafb':'#fff',cursor:'pointer',fontSize:13,color:'#888'}}>
                  ⏳ A definir
                </div>
              </div>

              <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Estado</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                {ESTADOS.map(e=>(
                  <div key={e} onClick={()=>setEstado(e)}
                    style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${estado===e?ESTADO_COR[e]:'#e5e7eb'}`,background:estado===e?ESTADO_COR[e]:'#fff',cursor:'pointer',fontSize:13,fontWeight:estado===e?700:400,color:estado===e?'#fff':'#444'}}>
                    {e}
                  </div>
                ))}
              </div>

              <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Notas adicionais</div>
              <textarea value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Pedidos especiais, observações..." rows={3}
                style={{...inp,resize:'none',fontFamily:'sans-serif'}}/>

              {servicoSel&&lavadoresSel.length>0&&(
                <div style={{background:'#fffbeb',border:'1px solid #C4922A',borderRadius:10,padding:12,marginBottom:12,fontSize:13}}>
                  💰 Comissão: {(servicoSel.pontos*VALOR_PONTO).toFixed(2)}€ ÷ {lavadoresSel.length} = <strong style={{color:'#C4922A'}}>{(servicoSel.pontos*VALOR_PONTO/lavadoresSel.length).toFixed(2)}€/pessoa</strong>
                </div>
              )}

              <button onClick={confirmarLavagem} style={btn('#16a34a')}>✅ Confirmar Agendamento</button>
              <button onClick={()=>setEcrã('servico')} style={{...btn('#888'),marginTop:6}}>← Voltar</button>
            </div>
          )}

          {ecrã==='confirmacao'&&sucesso&&(
            <div>
              <div style={{background:ESTADO_COR[sucesso.estado]||'#16a34a',borderRadius:12,padding:16,marginBottom:12,color:'#fff',textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:4}}>✅</div>
                <div style={{fontWeight:700,fontSize:16}}>Agendamento Registado!</div>
                <div style={{fontSize:13,opacity:0.9,marginTop:4}}>
                  {sucesso.dataSel?.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'})} às {sucesso.horaSel}
                </div>
                <div style={{marginTop:8,background:'rgba(255,255,255,0.2)',borderRadius:20,padding:'3px 12px',display:'inline-block',fontSize:12,fontWeight:600}}>
                  {sucesso.estado}
                </div>
              </div>

              <div style={{...card,padding:14,marginBottom:8}}>
                <div style={{display:'flex',gap:10,marginBottom:10,paddingBottom:10,borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:'#C4922A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,flexShrink:0}}>{veiculo?.nome_cliente?.charAt(0)||'?'}</div>
                  <div>
                    <div style={{fontWeight:700}}>{veiculo?.nome_cliente}</div>
                    <div style={{fontSize:12,color:'#888'}}>{veiculo?.telefone_cliente} · {veiculo?.matricula}</div>
                  </div>
                </div>
                {[
                  {l:'Serviço',v:sucesso.servico},
                  {l:'Valor',v:`${sucesso.valor}€`},
                  {l:'Viatura',v:veiculo?.marca_modelo||'—'},
                  {l:'Vendedor',v:sucesso.vendedor?.nome||'Não definido'},
                  {l:'Lavadores',v:sucesso.lavadores.length>0?sucesso.lavadores.map((f:any)=>f.nome).join(', '):'⏳ A definir'},
                  ...(sucesso.lavadores.length>0?[{l:'Comissão/pessoa',v:`${sucesso.comissaoIndividual.toFixed(2)}€`}]:[]),
                  ...(sucesso.notas?[{l:'Notas',v:sucesso.notas}]:[]),
                ].map(row=>(
                  <div key={row.l} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'5px 0',borderBottom:'1px solid #f9fafb'}}>
                    <span style={{color:'#888'}}>{row.l}</span>
                    <span style={{fontWeight:600,maxWidth:'60%',textAlign:'right'}}>{row.v}</span>
                  </div>
                ))}
              </div>

              {/* BOTÕES INDIVIDUAIS PARA COPIAR */}
              <div style={{...card,background:'#f8faff',borderColor:'#bfdbfe',padding:14,marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:13,color:'#1d4ed8',marginBottom:4}}>
                  📋 Copiar para a Agenda da Franquia
                </div>
                <div style={{fontSize:11,color:'#666',marginBottom:12}}>
                  1. Abre a agenda · 2. Copia cada campo · 3. Cola no campo correspondente
                </div>

                <BotaoCopiar label="Nome do Cliente" texto={veiculo?.nome_cliente||''} />
                <BotaoCopiar label="Telefone" texto={veiculo?.telefone_cliente||''} />
                <BotaoCopiar label="Matrícula / Viatura" texto={`${veiculo?.matricula} - ${veiculo?.marca_modelo||''}`} />
                <BotaoCopiar label="Data" texto={sucesso.dataSel?.toLocaleDateString('pt-PT')||''} />
                <BotaoCopiar label="Hora" texto={sucesso.horaSel} />
                <BotaoCopiar label="Serviço" texto={sucesso.servico} />
                <BotaoCopiar label="Vendedor" texto={sucesso.vendedor?.nome||'Não definido'} />
                <BotaoCopiar label="Lavadores" texto={sucesso.lavadores.length>0?sucesso.lavadores.map((f:any)=>f.nome).join(', '):'A definir'} />
                {sucesso.notas&&<BotaoCopiar label="Notas" texto={sucesso.notas} />}

                <a href={AGENDA_NOVA} target="_blank" rel="noopener noreferrer"
                  style={{display:'block',width:'100%',padding:'12px 0',background:'#C4922A',color:'#fff',borderRadius:12,fontSize:14,fontWeight:600,textDecoration:'none',boxSizing:'border-box' as const,textAlign:'center',marginTop:10}}>
                  🗓️ Abrir Agenda Nova Marcação
                </a>
              </div>

              <button onClick={resetar} style={btn('#C4922A')}>➕ Nova Entrada</button>
            </div>
          )}
        </div>
      )}

      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid #e5e7eb',display:'flex',padding:'8px 0'}}>
        <button onClick={()=>setVista('dashboard')} style={{flex:1,border:'none',background:'none',cursor:'pointer',padding:'6px 0',fontSize:11,color:vista==='dashboard'?'#C4922A':'#888',fontWeight:vista==='dashboard'?700:400}}>
          📊<br/>Dashboard
        </button>
        <button onClick={()=>setVista('agenda')} style={{flex:1,border:'none',background:'none',cursor:'pointer',padding:'6px 0',fontSize:11,color:vista==='agenda'?'#C4922A':'#888',fontWeight:vista==='agenda'?700:400}}>
          📅<br/>Agenda
        </button>
        <button onClick={()=>{setVista('entrada');setEcrã('pesquisa');}} style={{flex:1,border:'none',background:'none',cursor:'pointer',padding:'6px 0',fontSize:11,color:vista==='entrada'?'#C4922A':'#888',fontWeight:vista==='entrada'?700:400}}>
          🚗<br/>Nova Entrada
        </button>
      </div>
    </div>
  );
}
