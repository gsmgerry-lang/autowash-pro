'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wwmqwbyabgeghlfndgxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bXF3YnlhYmdlZ2hsZm5kZ3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDI5MTcsImV4cCI6MjA5NTAxODkxN30.wC2c5dhFH0dkuJuPP7NTp4wlJeTFHgr9ynK5el0_2S0'
);

const VALOR_PONTO = 4.50;

export default function Home() {
  const [sessao, setSessao] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErro, setLoginErro] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [ecrã, setEcrã] = useState<'pesquisa'|'novo'|'cliente'|'servico'|'lavadores'|'confirmacao'>('pesquisa');
  const [matricula, setMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [veiculo, setVeiculo] = useState<any>(null);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [servicoSel, setServicoSel] = useState<any>(null);
  const [lavadoresSel, setLavadoresSel] = useState<number[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novoTel, setNovoTel] = useState('');
  const [novoModelo, setNovoModelo] = useState('');
  const [sucesso, setSucesso] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) carregarDados();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session) carregarDados();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fazerLogin() {
    setLoginLoading(true);
    setLoginErro('');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) setLoginErro('Email ou password incorrectos');
    setLoginLoading(false);
  }

  async function fazerLogout() {
    await supabase.auth.signOut();
    setSessao(null);
  }

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
    if (error || !data) {
      setVeiculo({ matricula: matricula.toUpperCase() });
      setEcrã('novo');
    } else {
      const { data: ord } = await supabase.from('ordens_servico').select('*, servicos(nome)').eq('veiculo_id', data.id).order('data_registro', { ascending: false }).limit(5);
      setVeiculo(data);
      setOrdens(ord || []);
      setEcrã('cliente');
    }
    setLoading(false);
  }

  async function guardarNovoCliente() {
    if (!novoNome.trim()) return alert('Escreve o nome!');
    const { data, error } = await supabase.from('veiculos').insert({
      matricula: matricula.toUpperCase(),
      nome_cliente: novoNome,
      telefone_cliente: novoTel,
      marca_modelo: novoModelo
    }).select().single();
    if (error) return alert('Erro ao guardar!');
    setVeiculo(data);
    setOrdens([]);
    setEcrã('cliente');
  }

  function toggleLavador(id: number) {
    setLavadoresSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function confirmarLavagem() {
    if (!servicoSel || lavadoresSel.length === 0) return;
    const comissaoTotal = servicoSel.pontos * VALOR_PONTO;
    const comissaoIndividual = comissaoTotal / lavadoresSel.length;
    const pontosIndividuais = servicoSel.pontos / lavadoresSel.length;
    const { data: ordem, error } = await supabase.from('ordens_servico').insert({
      veiculo_id: veiculo.id,
      servico_id: servicoSel.id,
      funcionarios_alocados: lavadoresSel,
      valor_total: servicoSel.preco,
      comissao_individual_paga: comissaoIndividual,
      pontos_individuais_ganhos: pontosIndividuais,
    }).select().single();
    if (error) return alert('Erro ao registar!');
    for (const id of lavadoresSel) {
      await supabase.rpc('incrementar_stats_funcionario', {
        p_id_interno: id, p_pontos: pontosIndividuais, p_comissao: comissaoIndividual
      });
    }
    setSucesso({
      servico: servicoSel.nome, valor: servicoSel.preco, pontos: servicoSel.pontos,
      comissaoTotal, comissaoIndividual, nLavadores: lavadoresSel.length,
      lavadores: funcionarios.filter(f => lavadoresSel.includes(f.id_interno))
    });
    setEcrã('confirmacao');
  }

  function resetar() {
    setEcrã('pesquisa'); setMatricula(''); setVeiculo(null); setOrdens([]);
    setServicoSel(null); setLavadoresSel([]); setNovoNome(''); setNovoTel('');
    setNovoModelo(''); setSucesso(null);
  }

  const btn = (bg: string) => ({ width: '100%', padding: '12px 0', background: bg, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 10 });
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
          <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="email@exemplo.com" type="email"
            style={{ ...inp, marginBottom: 12 }} onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Password</div>
          <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" type="password"
            style={{ ...inp, marginBottom: 16 }} onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          {loginErro && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 10, textAlign: 'center' }}>{loginErro}</div>}
          <button onClick={fazerLogin} disabled={loginLoading} style={btn('#C4922A')}>
            {loginLoading ? 'A entrar...' : '🔐 Entrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>💧</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0' }}>AutoWash Pro</h1>
          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Sistema de Gestão</p>
        </div>
        <button onClick={fazerLogout} style={{ border: '1px solid #e5e7eb', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#888' }}>
          Sair
        </button>
      </div>

      {ecrã === 'pesquisa' && (
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Matrícula</div>
          <input value={matricula} onChange={e => setMatricula(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && pesquisar()} placeholder="AA-00-AA" maxLength={8}
            style={{ display: 'block', width: '100%', fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: 6, padding: '12px 0', border: '2px solid #e5e7eb', borderRadius: 12, marginTop: 6, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={pesquisar} disabled={loading} style={btn('#C4922A')}>
            {loading ? 'A pesquisar...' : '🔍 Pesquisar'}
          </button>
        </div>
      )}

      {ecrã === 'novo' && (
        <div style={{ ...card, background: '#fffbeb', borderColor: '#fcd34d' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Matrícula não encontrada</div>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>{matricula.toUpperCase()} · Novo cliente</div>
          <input placeholder="Nome completo *" value={novoNome} onChange={e => setNovoNome(e.target.value)} style={inp} />
          <input placeholder="Telefone / WhatsApp" value={novoTel} onChange={e => setNovoTel(e.target.value)} style={inp} />
          <input placeholder="Marca / Modelo" value={novoModelo} onChange={e => setNovoModelo(e.target.value)} style={inp} />
          <button onClick={guardarNovoCliente} style={btn('#C4922A')}>Guardar e Continuar →</button>
          <button onClick={resetar} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
        </div>
      )}

      {ecrã === 'cliente' && veiculo && (
        <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#C4922A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
              {veiculo.nome_cliente?.charAt(0) || '?'}
            </div>
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
          <button onClick={() => setEcrã('servico')} style={btn('#16a34a')}>Nova Lavagem →</button>
          <button onClick={resetar} style={{ ...btn('#888'), marginTop: 6 }}>← Nova Pesquisa</button>
        </div>
      )}

      {ecrã === 'servico' && (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Escolhe o serviço:</div>
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
          {servicoSel && (
            <div style={{ background: '#fffbeb', border: '1px solid #C4922A', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13 }}>
              <strong>{servicoSel.nome} {servicoSel.preco}€</strong> → Comissão: <strong style={{ color: '#C4922A' }}>{(servicoSel.pontos * VALOR_PONTO).toFixed(2)}€</strong>
            </div>
          )}
          <button onClick={() => servicoSel && setEcrã('lavadores')} style={btn(servicoSel ? '#C4922A' : '#ccc')}>Escolher Lavadores →</button>
          <button onClick={() => setEcrã('cliente')} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
        </div>
      )}

      {ecrã === 'lavadores' && (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Selecciona os lavadores:</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Toca para seleccionar</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {funcionarios.map(f => (
              <div key={f.id_interno} onClick={() => toggleLavador(f.id_interno)}
                style={{ padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${lavadoresSel.includes(f.id_interno) ? '#C4922A' : '#e5e7eb'}`, background: lavadoresSel.includes(f.id_interno) ? '#fffbeb' : '#fff', cursor: 'pointer', fontSize: 14, fontWeight: lavadoresSel.includes(f.id_interno) ? 700 : 400, color: lavadoresSel.includes(f.id_interno) ? '#C4922A' : '#444' }}>
                {f.id_interno}. {f.nome}
              </div>
            ))}
          </div>
          {lavadoresSel.length > 0 && servicoSel && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>💰 Divisão:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#888' }}>Total</div><div style={{ fontWeight: 700, color: '#C4922A' }}>{(servicoSel.pontos * VALOR_PONTO).toFixed(2)}€</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#888' }}>Lavadores</div><div style={{ fontWeight: 700 }}>{lavadoresSel.length}x</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#888' }}>Cada um</div><div style={{ fontWeight: 700, color: '#16a34a' }}>{(servicoSel.pontos * VALOR_PONTO / lavadoresSel.length).toFixed(2)}€</div></div>
              </div>
            </div>
          )}
          <button onClick={confirmarLavagem} disabled={lavadoresSel.length === 0} style={btn(lavadoresSel.length > 0 ? '#16a34a' : '#ccc')}>✅ Confirmar Lavagem</button>
          <button onClick={() => setEcrã('servico')} style={{ ...btn('#888'), marginTop: 6 }}>← Voltar</button>
        </div>
      )}

      {ecrã === 'confirmacao' && sucesso && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
          <h2 style={{ fontWeight: 700, marginBottom: 4 }}>Lavagem Registada!</h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>{veiculo?.nome_cliente} · {veiculo?.matricula}</p>
          <div style={{ ...card, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}><span style={{ color: '#888' }}>Serviço</span><span style={{ fontWeight: 600 }}>{sucesso.servico}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}><span style={{ color: '#888' }}>Valor</span><span style={{ fontWeight: 600 }}>{sucesso.valor}€</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}><span style={{ color: '#888' }}>Pontos</span><span style={{ fontWeight: 600, color: '#C4922A' }}>{sucesso.pontos} pts</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}><span style={{ color: '#888' }}>Comissão total</span><span style={{ fontWeight: 600, color: '#C4922A' }}>{sucesso.comissaoTotal.toFixed(2)}€</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 15 }}><span style={{ fontWeight: 600 }}>Por lavador ({sucesso.nLavadores}x)</span><span style={{ fontWeight: 700, color: '#16a34a', fontSize: 18 }}>{sucesso.comissaoIndividual.toFixed(2)}€</span></div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            {sucesso.lavadores.map((f: any) => (
              <div key={f.id_interno} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
                {f.nome} +{sucesso.comissaoIndividual.toFixed(2)}€
              </div>
            ))}
          </div>
          <button onClick={resetar} style={btn('#C4922A')}>➕ Nova Entrada</button>
        </div>
      )}
    </div>
  );
}
