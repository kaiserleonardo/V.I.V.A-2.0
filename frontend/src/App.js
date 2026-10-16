import { useEffect, useRef, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { BookOpen, Brain, Check, ChevronRight, CircleHelp, Clock3, Eye, FileText, History, House, LogIn, Menu, Moon, Plus, RotateCcw, Save, Settings, Sparkles, Sun, Trash2, Volume2, X } from "lucide-react";
import "@/App.css";

const API = process.env.REACT_APP_BACKEND_URL;
const IMAGE_MODELS = { gptimage: "GPT Image", flux: "FLUX.1", "flux-realism": "FLUX Realismo", "bytedance/seedream-5.0-pro": "SeeDream 5.0 Pro", turbo: "SDXL Turbo" };

const defaultSubjects = [
  { id: "pt", name: "Português", emoji: "📖", desc: "Gramática, leitura e ortografia" },
  { id: "mat", name: "Matemática", emoji: "🔢", desc: "Cálculos, operações e formas" },
  { id: "hist", name: "História", emoji: "🏛️", desc: "Fatos históricos e sociedade" },
  { id: "geo", name: "Geografia", emoji: "🌍", desc: "Mapas, natureza e regiões" },
];
const navItems = [
  ["inicio", "Início", House], ["aprender", "Aprender com IA", Brain], ["quiz", "Questionário", CircleHelp],
  ["solucoes", "Soluções", FileText], ["anotacoes", "Anotações", BookOpen], ["historico", "Histórico", History], ["configuracoes", "Configurações", Settings],
];
const readText = (text) => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } };
const aiPost = async (path, body) => {
  const r = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "erro");
  return d;
};
const formatDetail = (detail) => {
  if (!detail) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || String(e)).join(" ");
  return String(detail);
};

function App() {
  const [view, setView] = useState("inicio");
  const [role, setRole] = useState(() => localStorage.getItem("viva_role"));
  const [dark, setDark] = useState(() => localStorage.getItem("viva_theme") === "dark");
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("viva_font_size") || "normal");
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem("viva_reduce_anim") === "true");
  const [tts, setTts] = useState(() => localStorage.getItem("viva_tts") !== "false");
  const [imageModel, setImageModel] = useState(() => localStorage.getItem("viva_image_model") || "gptimage");
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("viva_user") || "null"));
  const [token, setToken] = useState(() => localStorage.getItem("viva_token"));
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem("viva_subjects") || "null") || defaultSubjects);
  const [activeSubject, setActiveSubject] = useState(null);
  const [topic, setTopic] = useState("");
  const [explanation, setExplanation] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("viva_history") || "[]"));
  const [notes, setNotes] = useState(() => JSON.parse(localStorage.getItem("viva_notes") || "[]"));
  const [noteId, setNoteId] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [subjectForm, setSubjectForm] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: "", emoji: "📚", desc: "" });
  const [exercise, setExercise] = useState("");
  const [solution, setSolution] = useState(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const currentNote = notes.find((n) => n.id === noteId) || notes[0];
  const sessionChecked = useRef(false);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : ""; localStorage.setItem("viva_theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { document.documentElement.dataset.reduceAnimations = reduceMotion; localStorage.setItem("viva_reduce_anim", reduceMotion); }, [reduceMotion]);
  useEffect(() => { document.documentElement.style.setProperty("--font-scale", fontSize === "grande" ? "18px" : fontSize === "extragrande" ? "21px" : "16px"); localStorage.setItem("viva_font_size", fontSize); }, [fontSize]);
  useEffect(() => { localStorage.setItem("viva_tts", tts); }, [tts]);
  useEffect(() => { localStorage.setItem("viva_image_model", imageModel); }, [imageModel]);
  useEffect(() => { localStorage.setItem("viva_subjects", JSON.stringify(subjects)); }, [subjects]);
  useEffect(() => { localStorage.setItem("viva_notes", JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem("viva_history", JSON.stringify(history)); }, [history]);

  const syncAfterAuth = async (tok) => {
    try {
      const r = await fetch(`${API}/api/data`, { headers: { Authorization: `Bearer ${tok}` } });
      const d = await r.json();
      if (d.subjects?.length || d.notes?.length || d.history?.length) {
        if (d.subjects?.length) setSubjects(d.subjects);
        setNotes(d.notes || []);
        setHistory(d.history || []);
      } else {
        await fetch(`${API}/api/data`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ subjects: JSON.parse(localStorage.getItem("viva_subjects") || "null") || defaultSubjects, notes: JSON.parse(localStorage.getItem("viva_notes") || "[]"), history: JSON.parse(localStorage.getItem("viva_history") || "[]") }) });
      }
    } catch {}
  };
  const handleAuth = (tok, account) => { setToken(tok); localStorage.setItem("viva_token", tok); setUser(account); localStorage.setItem("viva_user", JSON.stringify(account)); setAuthOpen(false); syncAfterAuth(tok); };
  const handleLogout = () => { setToken(null); localStorage.removeItem("viva_token"); setUser(null); localStorage.removeItem("viva_user"); setAuthOpen(false); };

  useEffect(() => {
    if (sessionChecked.current) return;
    sessionChecked.current = true;
    if (!token) return;
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => {
      if (r.ok) { const d = await r.json(); setUser(d.user); localStorage.setItem("viva_user", JSON.stringify(d.user)); syncAfterAuth(token); }
      else { setToken(null); localStorage.removeItem("viva_token"); setUser(null); localStorage.removeItem("viva_user"); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => { fetch(`${API}/api/data`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ subjects, notes, history: history.slice(0, 100) }) }).catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [subjects, notes, history, token]);

  const go = (next) => { if (next === "solucoes" && role === "aluno") return; setView(next); setMobileNav(false); };
  const chooseRole = (next) => { setRole(next); localStorage.setItem("viva_role", next); };
  const selectSubject = (subject) => { setActiveSubject(subject); setView("aprender"); setTopic(""); setExplanation(null); };
  const pushHistory = (topicText, subjectName) => setHistory((items) => [{ id: Date.now(), topic: topicText, subject: subjectName, date: new Date().toLocaleDateString("pt-BR") }, ...items.filter((item) => item.topic.toLowerCase() !== topicText.toLowerCase())]);
  const generateExplanation = async () => {
    if (!topic.trim() || explainLoading) return;
    const subject = activeSubject?.name || "Geral";
    setExplainLoading(true); setExplanation(null);
    try {
      const d = await aiPost("/api/ai/explain", { topic, subject });
      setExplanation({ title: topic, subject, body: d.html || "<p>Não foi possível gerar a explicação. Tente novamente.</p>" });
      pushHistory(topic, subject);
    } catch {
      setExplanation({ title: topic, subject, body: `<p><strong>Não foi possível conectar aos serviços de IA.</strong></p><p>Verifique a sua conexão com a Internet e tente novamente.</p>` });
    } finally { setExplainLoading(false); }
  };
  const generateSolution = async (materia) => {
    if (!exercise.trim() || solutionLoading) return;
    setSolutionLoading(true); setSolution(null);
    try {
      const d = await aiPost("/api/ai/solve", { exercise, subject: materia });
      setSolution({ title: exercise, body: d.html || "<p>Não foi possível gerar a solução. Tente novamente.</p>" });
      pushHistory(`[Solução] ${exercise}`, materia);
    } catch {
      setSolution({ title: exercise, body: `<p><strong>Não foi possível gerar a solução do exercício.</strong></p><p>Verifique a sua conexão com a Internet e tente novamente.</p>` });
    } finally { setSolutionLoading(false); }
  };
  const createSubject = () => { if (!newSubject.name.trim()) return; setSubjects([...subjects, { ...newSubject, id: Date.now().toString(), desc: newSubject.desc || "Matéria de estudo" }]); setNewSubject({ name: "", emoji: "📚", desc: "" }); setSubjectForm(false); };
  const addNote = () => { const note = { id: Date.now(), title: "Nova anotação", category: "Estudos", body: "" }; setNotes([note, ...notes]); setNoteId(note.id); };
  const updateNote = (key, value) => setNotes(notes.map((n) => n.id === currentNote?.id ? { ...n, [key]: value } : n));

  return <BrowserRouter><div className="viva-shell" data-testid="viva-app">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`} data-testid="main-sidebar">
      <div className="brand" data-testid="brand-home" onClick={() => go("inicio")}><span className="brand-mark">✦</span><span><b>V.I.V.A</b><small>estudo para cada mente</small></span></div>
      <div className="profile-chip" data-testid="sidebar-profile" onClick={() => setAuthOpen(true)}><span className="avatar">{user?.avatar || "🌱"}</span><span><b>{user?.name || "Visitante"}</b><small>{user?.email || (role === "professor" ? "Professor" : role === "aluno" ? "Aluno" : "Escolha um perfil")}</small></span><ChevronRight size={16}/></div>
      <nav aria-label="Navegação principal">{navItems.map(([id, label, Icon]) => <button key={id} className={`nav-item ${view === id ? "active" : ""} ${id === "solucoes" && role === "aluno" ? "disabled" : ""}`} onClick={() => go(id)} data-testid={`nav-${id}`}><Icon size={18}/><span>{label}</span>{id === "aprender" && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="inclusive-note"><span>♾</span><p><b>Espaço para todas as mentes.</b><br/>Acessibilidade primeiro, sempre.</p></div><button className="theme-toggle" onClick={() => setDark(!dark)} data-testid="theme-toggle">{dark ? <Sun size={17}/> : <Moon size={17}/>} {dark ? "Modo claro" : "Modo escuro"}</button></div>
    </aside>
    <main className="main-content"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} data-testid="mobile-menu"><Menu/></button><div className="breadcrumb"><span>V.I.V.A</span><ChevronRight size={14}/><b>{navItems.find((n) => n[0] === view)?.[1]}</b></div><div className="top-actions"><span className="accessibility-badge"><Eye size={15}/> experiência acessível</span><button className="icon-action" onClick={() => setAuthOpen(true)} data-testid="open-auth"><LogIn size={18}/></button></div></header>
      <div className="page-wrap">{view === "inicio" && <Home go={go} selectSubject={selectSubject} subjects={subjects} user={user}/>} {view === "aprender" && <Learn activeSubject={activeSubject} setActiveSubject={setActiveSubject} subjects={subjects} selectSubject={selectSubject} topic={topic} setTopic={setTopic} generate={generateExplanation} loading={explainLoading} explanation={explanation} tts={tts} imageModel={imageModel} openSubjectForm={() => setSubjectForm(true)}/>} {view === "quiz" && <Quiz subjects={subjects}/>} {view === "solucoes" && <Solutions subjects={subjects} exercise={exercise} setExercise={setExercise} generate={generateSolution} loading={solutionLoading} solution={solution} tts={tts}/>} {view === "anotacoes" && <Notes notes={notes} current={currentNote} noteId={noteId || notes[0]?.id} setNoteId={setNoteId} add={addNote} update={updateNote} remove={() => { setNotes(notes.filter(n => n.id !== currentNote?.id)); setNoteId(null); }}/>} {view === "historico" && <HistoryView history={history} clear={() => setHistory([])} revisit={(item) => { setActiveSubject(subjects.find(s => s.name === item.subject) || null); setTopic(item.topic); setExplanation(null); setView("aprender"); }}/>} {view === "configuracoes" && <SettingsView role={role} setRole={(next) => { setRole(next); localStorage.setItem("viva_role", next); }} dark={dark} setDark={setDark} tts={tts} setTts={setTts} reduceMotion={reduceMotion} setReduceMotion={setReduceMotion} fontSize={fontSize} setFontSize={setFontSize} imageModel={imageModel} setImageModel={setImageModel} user={user} openAccount={() => setAuthOpen(true)}/>}</div>
    </main>
    {!role && <RoleModal choose={chooseRole}/>} {authOpen && <AuthModal user={user} onAuth={handleAuth} onLogout={handleLogout} close={() => setAuthOpen(false)}/>} {subjectForm && <SubjectModal subject={newSubject} setSubject={setNewSubject} save={createSubject} close={() => setSubjectForm(false)}/>}<button className="floating-help" data-testid="accessibility-help" aria-label="Ajuda de acessibilidade"><span>?</span></button>
  </div></BrowserRouter>;
}

function Home({ go, selectSubject, subjects, user }) { return <section className="home-view" data-testid="home-view"><div className="eyebrow"><span className="eyebrow-line"/> APRENDIZAGEM VISUAL INTERATIVA <span className="eyebrow-line"/></div><div className="hero-grid"><div className="hero-copy"><p className="kicker">Olá, {user?.name || "visitante"} <span>✦</span></p><h1>Aprender pode<br/><em>parecer</em> diferente.</h1><p className="hero-lead">O V.I.V.A transforma matérias escolares em explicações visuais, diretas e acolhedoras — no seu ritmo, do seu jeito.</p><div className="hero-actions"><button className="btn-primary" onClick={() => go("aprender")} data-testid="hero-start-learning">Começar a aprender <ChevronRight size={17}/></button><button className="btn-quiet" onClick={() => go("quiz")} data-testid="hero-quiz">Testar conhecimentos <span>↗</span></button></div><div className="hero-trust"><div className="mini-avatars"><span>🌻</span><span>🎨</span><span>🚀</span></div><span>Feito para diferentes<br/><b>formas de pensar.</b></span></div></div><div className="hero-art" data-testid="hero-art"><img src="https://static.prod-images.emergentagent.com/jobs/ad2bd83d-0063-419f-b6c4-d7f314f32fa9/images/990ef6436d28fdef5e01caecdc19ede12a0314834b1d7a4edfe9598d0bf38071.jpeg" alt="Ilustração de um jovem estudando com calma numa escrivaninha organizada, usando fones abafadores de ruído, com um pôster do símbolo do infinito colorido da neurodiversidade na parede" data-testid="hero-image"/><div className="art-caption"><span>01</span><b>Um espaço<br/>para aprender</b><span className="caption-arrow">↗</span></div></div></div><div className="home-section-head"><div><p className="section-label">A SUA JORNADA</p><h2>Por onde começamos?</h2></div><button className="text-link" onClick={() => go("aprender")} data-testid="home-see-subjects">Ver todas as matérias <ChevronRight size={16}/></button></div><div className="subject-strip">{subjects.slice(0, 4).map((s, i) => <button key={s.id} className={`subject-tile tile-${i}`} onClick={() => selectSubject(s)} data-testid={`home-subject-${s.id}`}><span className="tile-emoji">{s.emoji}</span><span><b>{s.name}</b><small>{s.desc}</small></span><ChevronRight size={16}/></button>)}</div><div className="feature-band" data-testid="home-feature-band"><div><span className="feature-icon"><Sparkles size={18}/></span><div><b>Feito para tornar o complexo mais claro.</b><p>Texto simples, ilustrações e ferramentas que respeitam a sua atenção.</p></div></div><span className="band-number">V.I.V.A / 01</span></div></section> }

function Learn({ activeSubject, setActiveSubject, subjects, selectSubject, topic, setTopic, generate, loading, explanation, tts, imageModel, openSubjectForm }) { return <section data-testid="learn-view"><div className="section-intro"><div><p className="section-label">APRENDER COM IA</p><h1>O que você quer <em>compreender?</em></h1><p>Escolha uma matéria e transforme uma dúvida em uma explicação visual, passo a passo.</p></div><div className="round-mark">✦</div></div>{!activeSubject ? <><div className="content-toolbar"><h2>Suas matérias</h2><button className="btn-outline" onClick={openSubjectForm} data-testid="new-subject-button"><Plus size={17}/> Nova matéria</button></div><div className="subject-grid">{subjects.map((s) => <button className="subject-card" key={s.id} onClick={() => selectSubject(s)} data-testid={`subject-card-${s.id}`}><span className="card-top"><span className="subject-emoji">{s.emoji}</span><span>↗</span></span><b>{s.name}</b><p>{s.desc}</p><span className="card-index">MATÉRIA / {String(subjects.indexOf(s) + 1).padStart(2, "0")}</span></button>)}</div><div className="tip-card"><span>♿</span><p><b>Dica de estudo gentil</b><br/>Você não precisa aprender tudo de uma vez. Pequenos passos também são progresso.</p></div></> : <div className="learning-panel"><button className="back-link" onClick={() => setActiveSubject(null)} data-testid="back-to-subjects">← Todas as matérias</button><div className="learning-head"><div><span className="subject-pill">{activeSubject.emoji} {activeSubject.name}</span><h2>Vamos tornar isso mais claro.</h2></div><span className="learning-number">APRENDER / 01</span></div><div className="prompt-card"><label htmlFor="topic-input">Digite um tema, pergunta ou curiosidade</label><textarea id="topic-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: Como funciona a fotossíntese?" data-testid="topic-input"/><div className="prompt-footer"><span>✦ linguagem simples e visual</span><button className="btn-primary" onClick={generate} disabled={loading} data-testid="generate-explanation">{loading ? "A gerar..." : "Gerar explicação"} <Sparkles size={16}/></button></div></div>{loading && <div className="result-grid"><article className="result-card" data-testid="explanation-loading"><p className="section-label">A GERAR</p><h3>A Inteligência Artificial está a gerar o conteúdo...</h3><p className="rich-copy">A criar resumo neuroinclusivo e ilustração didática personalizada. Isto pode levar alguns segundos.</p></article><IllustrationCard topic={topic} subject={activeSubject.name} imageModel={imageModel}/></div>}{!loading && explanation && <div className="result-grid"><article className="result-card"><div className="result-card-head"><div><p className="section-label">EXPLICAÇÃO GUIADA</p><h3>{explanation.title}</h3></div>{tts && <button className="audio-button" onClick={() => readText(explanation.body.replace(/<[^>]+>/g, ""))} data-testid="read-explanation"><Volume2 size={16}/> Ouvir</button>}</div><div className="rich-copy" dangerouslySetInnerHTML={{ __html: explanation.body }} data-testid="explanation-result"/></article><IllustrationCard topic={explanation.title} subject={explanation.subject} imageModel={imageModel}/></div>}</div>}</section> }

function IllustrationCard({ topic, subject, imageModel }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 900000) + 100000);
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState(0);
  useEffect(() => { setSeed(Math.floor(Math.random() * 900000) + 100000); setLoaded(false); setStage(0); }, [topic, subject, imageModel]);
  const src = `${API}/api/ai/image?topic=${encodeURIComponent(topic)}&subject=${encodeURIComponent(subject)}&model=${encodeURIComponent(imageModel)}&seed=${seed}${stage >= 1 ? "&fallback=1" : ""}`;
  return <div className="visual-card illu-card" data-testid="illustration-card">
    <div className="visual-sun">✦</div>
    <p className="illu-title">ILUSTRAÇÃO DIDÁTICA ({IMAGE_MODELS[imageModel] || imageModel})</p>
    {stage >= 2 ? <div className="img-loading" data-testid="illustration-error">Não foi possível carregar a ilustração.</div> : <>
      {!loaded && <div className="img-loading" data-testid="illustration-loading">A criar ilustração didática...</div>}
      <img src={src} alt={`Ilustração didática sobre ${topic}`} data-testid="illustration-image" onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setStage((s) => s + 1); }} style={{ display: loaded ? "block" : "none" }}/>
    </>}
    <div className="illu-actions"><button onClick={() => { setSeed(Math.floor(Math.random() * 900000) + 100000); setLoaded(false); setStage(0); }} data-testid="regenerate-image"><RotateCcw size={13}/> Regerar imagem</button></div>
  </div>;
}

function Quiz({ subjects }) {
  const [materia, setMateria] = useState(subjects[0]?.name || "Geral");
  const [tema, setTema] = useState("");
  const [qtd, setQtd] = useState(5);
  const [status, setStatus] = useState("");
  const [game, setGame] = useState(null);
  const gerar = async () => {
    setStatus("loading"); setGame(null);
    try {
      const d = await aiPost("/api/ai/quiz", { subject: materia, topic: tema, count: Number(qtd) });
      setGame({ questions: d.questions, index: 0, score: 0, selected: null, finished: false });
      setStatus("");
    } catch { setStatus("Não foi possível gerar o questionário. Verifique a sua conexão e tente novamente."); }
  };
  const responder = (i) => { if (!game || game.selected !== null) return; const q = game.questions[game.index]; setGame({ ...game, selected: i, score: i === q.respostaCorreta ? game.score + 1 : game.score }); };
  const proxima = () => { const last = game.index === game.questions.length - 1; setGame({ ...game, index: last ? game.index : game.index + 1, selected: null, finished: last }); };
  return <section data-testid="quiz-view"><div className="section-intro compact"><div><p className="section-label">QUESTIONÁRIO DE ESTUDO</p><h1>Aprender é também <em>experimentar.</em></h1><p>Uma pergunta de cada vez. Sem pressa, sem julgamento.</p></div><div className="quiz-symbol">?</div></div>
    {!game ? <div className="quiz-start card-panel"><div className="big-icon">◌</div><h2>Pronto para um pequeno desafio?</h2><p>A IA cria perguntas novas sobre a matéria que você escolher.</p>
      <div className="setup-grid">
        <div><label htmlFor="quiz-materia">Matéria</label><select id="quiz-materia" value={materia} onChange={(e) => setMateria(e.target.value)} data-testid="quiz-subject-select">{subjects.map((s) => <option key={s.id} value={s.name}>{s.emoji} {s.name}</option>)}</select></div>
        <div><label htmlFor="quiz-tema">Tema (opcional)</label><input id="quiz-tema" value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex.: fotossíntese, frações..." data-testid="quiz-topic-input"/></div>
        <div><label htmlFor="quiz-qtd">Quantidade de perguntas</label><select id="quiz-qtd" value={qtd} onChange={(e) => setQtd(e.target.value)} data-testid="quiz-count-select"><option value={5}>5 perguntas</option><option value={10}>10 perguntas</option><option value={15}>15 perguntas</option></select></div>
      </div>
      <button className="btn-primary" onClick={gerar} disabled={status === "loading"} data-testid="generate-quiz-button">{status === "loading" ? "A gerar perguntas..." : "Gerar questionário"} <Sparkles size={16}/></button>
      {status === "loading" && <p className="quiz-status" data-testid="quiz-status">A IA está a criar as perguntas... isto pode levar até um minuto.</p>}
      {status && status !== "loading" && <p className="quiz-status error" data-testid="quiz-status">{status}</p>}
    </div> : game.finished ? <div className="quiz-card card-panel"><div className="quiz-result" data-testid="quiz-summary"><span className="check-result"><Check/></span><p className="section-label">RESULTADO</p><h2>Questionário concluído!</h2><p className="quiz-score" data-testid="quiz-score">{game.score} / {game.questions.length}</p><p>{game.score === game.questions.length ? "Impressionante — acertou tudo!" : game.score >= game.questions.length / 2 ? "Muito bem! Continue a praticar com calma." : "Tudo bem, errar também faz parte de aprender."}</p><button className="btn-primary" onClick={() => setGame(null)} data-testid="quiz-restart"><RotateCcw size={16}/> Novo questionário</button></div></div> : <div className="quiz-card card-panel"><div className="quiz-meta"><span>PERGUNTA {String(game.index + 1).padStart(2, "0")} / {String(game.questions.length).padStart(2, "0")}</span><span>{materia.toUpperCase()}</span></div><div className="progress-line"><span style={{ width: `${(game.index / game.questions.length) * 100}%` }}/></div><h2>{game.questions[game.index].pergunta}</h2><div className="quiz-options">{game.questions[game.index].opcoes.map((option, i) => { const q = game.questions[game.index]; const cls = game.selected === null ? "" : i === q.respostaCorreta ? "correct" : i === game.selected ? "wrong" : ""; return <button key={`${game.index}-${i}`} className={`quiz-option ${cls}`} disabled={game.selected !== null} onClick={() => responder(i)} data-testid={`quiz-option-${i}`}><span>{String.fromCharCode(65 + i)}</span>{option}</button>; })}</div>
      {game.selected !== null && <div className="quiz-feedback" data-testid="quiz-feedback"><b>{game.selected === game.questions[game.index].respostaCorreta ? "✓ Resposta certa!" : "✗ Não foi desta vez."}</b>{game.questions[game.index].explicacao && <p>{game.questions[game.index].explicacao}</p>}<button className="btn-primary" onClick={proxima} data-testid="quiz-next">{game.index === game.questions.length - 1 ? "Ver resultado" : "Próxima pergunta"} <ChevronRight size={16}/></button></div>}
    </div>}</section>;
}

function Solutions({ subjects, exercise, setExercise, generate, loading, solution, tts }) { const [materia, setMateria] = useState(subjects[0]?.name || "Geral"); return <section data-testid="solutions-view"><div className="section-intro compact"><div><p className="section-label">PARA PROFESSORES</p><h1>Resolver também <em>é aprender.</em></h1><p>Organize uma questão em passos claros para acompanhar o raciocínio.</p></div><div className="solution-symbol">→</div></div><div className="solution-layout"><div className="card-panel solution-form"><label htmlFor="solution-subject">Matéria</label><select id="solution-subject" className="solution-select" value={materia} onChange={(e) => setMateria(e.target.value)} data-testid="solution-subject-select">{subjects.map((s) => <option key={s.id} value={s.name}>{s.emoji} {s.name}</option>)}</select><label htmlFor="exercise-input">Pergunta ou exercício</label><textarea id="exercise-input" value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Cole aqui um exercício de matemática, história..." data-testid="exercise-input"/><button className="btn-primary" onClick={() => generate(materia)} disabled={loading} data-testid="generate-solution">{loading ? "A resolver..." : "Gerar solução passo a passo"} <Sparkles size={16}/></button><p className="form-hint">{loading ? "A IA está a resolver o exercício passo a passo..." : "A resposta é organizada em linguagem direta e acolhedora."}</p></div>{solution ? <article className="card-panel solution-result"><div className="result-card-head"><div><p className="section-label">SOLUÇÃO GUIADA</p><h3>{solution.title}</h3></div>{tts && <button className="audio-button" onClick={() => readText(solution.body.replace(/<[^>]+>/g, ""))} data-testid="read-solution"><Volume2 size={16}/> Ouvir</button>}</div><div className="rich-copy" dangerouslySetInnerHTML={{ __html: solution.body }} data-testid="solution-result"/></article> : <div className="empty-illustration"><FileText size={35}/><p>{loading ? "A organizar etapas sequenciais e texto instrutivo simples..." : "A sua resolução aparecerá aqui."}</p></div>}</div></section> }

function Notes({ notes, current, noteId, setNoteId, add, update, remove }) { return <section data-testid="notes-view"><div className="section-intro compact"><div><p className="section-label">BLOCO DE ANOTAÇÕES</p><h1>Ideias para <em>guardar.</em></h1><p>Um espaço calmo para resumos, lembretes e descobertas.</p></div><button className="btn-primary" onClick={add} data-testid="new-note"><Plus size={17}/> Nova anotação</button></div><div className="notes-layout card-panel"><aside className="notes-list">{notes.length ? notes.map((note) => <button className={note.id === noteId ? "selected" : ""} key={note.id} onClick={() => setNoteId(note.id)} data-testid={`note-${note.id}`}><b>{note.title || "Sem título"}</b><small>{note.category || "Estudos"}</small><p>{note.body || "Comece a escrever..."}</p></button>) : <p className="muted">Nenhuma anotação ainda.</p>}</aside>{current ? <div className="note-editor"><div className="editor-status"><span><span className="save-dot"/> Salvo localmente</span><button onClick={remove} data-testid="delete-note"><Trash2 size={16}/> Eliminar</button></div><input value={current.title} onChange={(e) => update("title", e.target.value)} placeholder="Título da anotação" data-testid="note-title"/><input className="category-input" value={current.category} onChange={(e) => update("category", e.target.value)} placeholder="Categoria / matéria" data-testid="note-category"/><textarea value={current.body} onChange={(e) => update("body", e.target.value)} placeholder="Escreva aqui os seus pensamentos..." data-testid="note-body"/><span className="editor-tip"><Save size={14}/> Guardado automaticamente</span></div> : <div className="empty-notes"><BookOpen size={31}/><p>Crie a sua primeira anotação.</p></div>}</div></section> }

function HistoryView({ history, clear, revisit }) { return <section data-testid="history-view"><div className="section-intro compact"><div><p className="section-label">HISTÓRICO DE PESQUISAS</p><h1>Volte ao que <em>descobriu.</em></h1><p>As suas consultas ficam aqui para uma revisão tranquila.</p></div>{history.length > 0 && <button className="btn-outline danger" onClick={clear} data-testid="clear-history"><Trash2 size={16}/> Limpar tudo</button>}</div><div className="history-list card-panel">{history.length ? history.map((item) => <div className="history-row" key={item.id}><span className="history-icon"><Clock3 size={17}/></span><div><b>{item.topic}</b><small>{item.subject} · {item.date}</small></div><button className="text-link" onClick={() => revisit(item)} data-testid={`review-${item.id}`}>Revisar <ChevronRight size={15}/></button></div>) : <div className="empty-state"><History size={32}/><h3>Ainda não há consultas</h3><p>Quando você estudar um tema, ele aparecerá aqui.</p></div>}</div></section> }

function ProfileCard({ role, setRole, user, openAccount }) {
  const roleName = role === "professor" ? "Professor" : "Aluno";
  return <div className="profile-card" data-testid="settings-profile-card">
    <div className="profile-card-head"><span className="profile-card-avatar" data-testid="settings-profile-avatar">{user?.avatar || "🌱"}</span><div><b>Perfil atual</b><small>As informações da sua conta neste aparelho.</small></div></div>
    <dl className="profile-card-info">
      <div><dt>Nome</dt><dd data-testid="settings-profile-name">{user?.name || "Visitante"}</dd></div>
      <div><dt>E-mail</dt><dd data-testid="settings-profile-email">{user?.email || "Nenhuma conta conectada"}</dd></div>
      <div><dt>Tipo de perfil</dt><dd><span className="role-tag" data-testid="settings-profile-role">{roleName}</span></dd></div>
    </dl>
    <div className="profile-card-actions"><button className="btn-outline" onClick={() => setRole(role === "professor" ? "aluno" : "professor")} data-testid="change-role">Trocar para {role === "professor" ? "Aluno" : "Professor"}</button><button className="btn-quiet" onClick={openAccount} data-testid="settings-manage-account">{user ? "Gerenciar conta" : "Entrar ou criar conta"} <ChevronRight size={15}/></button></div>
  </div>;
}
function SettingsView({ role, setRole, dark, setDark, tts, setTts, reduceMotion, setReduceMotion, fontSize, setFontSize, imageModel, setImageModel, user, openAccount }) { return <section data-testid="settings-view"><div className="section-intro compact"><div><p className="section-label">CONFIGURAÇÕES</p><h1>Deixe o V.I.V.A <em>mais seu.</em></h1><p>Pequenos ajustes que fazem uma grande diferença.</p></div><Settings className="settings-mark" size={42}/></div><div className="settings-grid"><div className="settings-group card-panel"><p className="section-label">ACESSIBILIDADE & CONFORTO</p><SettingRow icon={<Volume2/>} title="Leitura em voz alta" desc="Ativa botões de áudio junto às explicações." checked={tts} onChange={setTts} testid="toggle-tts"/><SettingRow icon={<Eye/>} title="Reduzir animações" desc="Diminui movimentos e transições da interface." checked={reduceMotion} onChange={setReduceMotion} testid="toggle-motion"/><div className="select-row"><span className="setting-icon">Aa</span><div><b>Tamanho do texto</b><small>Ajuste o tamanho para ler com conforto.</small></div><select value={fontSize} onChange={(e) => setFontSize(e.target.value)} data-testid="font-size-select"><option value="normal">Padrão</option><option value="grande">Grande</option><option value="extragrande">Extra grande</option></select></div></div><div className="settings-group card-panel"><p className="section-label">APARÊNCIA & PERFIL</p><SettingRow icon={dark ? <Sun/> : <Moon/>} title={dark ? "Modo claro" : "Modo escuro"} desc="Escolha o contraste que funciona melhor para si." checked={dark} onChange={setDark} testid="toggle-theme"/><ProfileCard role={role} setRole={setRole} user={user} openAccount={openAccount}/><div className="select-row"><span className="setting-icon">🎨</span><div><b>Modelo de IA para imagens</b><small>Escolha a IA que cria as ilustrações didáticas.</small></div><select value={imageModel} onChange={(e) => setImageModel(e.target.value)} data-testid="image-model-select">{Object.entries(IMAGE_MODELS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div><div className="settings-callout"><span>✦</span><p><b>Com uma conta, os seus estudos viajam com você.</b><br/>Anotações, matérias e histórico ficam salvos no banco de dados.</p></div></div></div></section> }
function SettingRow({ icon, title, desc, checked, onChange, testid }) { return <div className="setting-row"><span className="setting-icon">{icon}</span><div><b>{title}</b><small>{desc}</small></div><button className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked} aria-label={title} data-testid={testid}><span/></button></div> }
function RoleModal({ choose }) { return <div className="modal-backdrop"><div className="role-modal" data-testid="role-modal"><div className="modal-kicker">BEM-VINDO AO V.I.V.A <span>✦</span></div><h2>Como você quer<br/><em>começar hoje?</em></h2><p>Escolha um perfil para personalizarmos o seu espaço de aprendizagem.</p><div className="role-options"><button onClick={() => choose("aluno")} data-testid="role-student"><span className="role-emoji">🎓</span><span className="role-text"><b>Sou aluno(a)</b><small>Explorar, compreender e praticar.</small></span><ChevronRight/></button><button onClick={() => choose("professor")} data-testid="role-teacher"><span className="role-emoji">👩‍🏫</span><span className="role-text"><b>Sou professor(a)</b><small>Criar soluções e apoiar o estudo.</small></span><ChevronRight/></button></div><small className="modal-footnote">Você pode alterar isso mais tarde.</small></div></div> }
function AuthModal({ user, onAuth, onLogout, close }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError(""); setBusy(true);
    try {
      const body = mode === "register" ? { name, email, password } : { email, password };
      const r = await fetch(`${API}/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(formatDetail(d.detail));
      onAuth(d.token, d.user);
    } catch (e) { setError(e.message || "Erro ao conectar."); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={close}><div className="auth-modal" onClick={(e) => e.stopPropagation()} data-testid="auth-modal"><button className="modal-close" onClick={close} data-testid="close-auth"><X/></button><span className="modal-avatar">{user?.avatar || "🌱"}</span><p className="section-label">CONTA V.I.V.A</p>{user ? <><h2>Olá, {user.name}.</h2><p>A sua conta <b>{user.email}</b> guarda matérias, anotações e histórico no banco de dados — acesse de qualquer dispositivo.</p><button className="btn-outline danger" onClick={onLogout} data-testid="logout">Sair da conta</button></> : <><h2>{mode === "login" ? "Que bom ver você." : "Seu espaço, seu ritmo."}</h2><p>{mode === "login" ? "Entre com o seu e-mail e senha." : "Crie a sua conta com e-mail e senha para guardar os estudos."}</p><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }} data-testid="auth-tab-login">Entrar</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }} data-testid="auth-tab-register">Criar conta</button></div>{mode === "register" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome ou apelido" data-testid="auth-name"/>}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" data-testid="auth-email"/><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "Senha (mínimo 6 caracteres)" : "Sua senha"} data-testid="auth-password" onKeyDown={(e) => e.key === "Enter" && submit()}/>{error && <p className="auth-error" data-testid="auth-error">{error}</p>}<button className="btn-primary full" onClick={submit} disabled={busy} data-testid="auth-submit">{busy ? "Um momento..." : mode === "login" ? "Entrar" : "Criar conta"} <ChevronRight size={16}/></button></>}</div></div>;
}
function SubjectModal({ subject, setSubject, save, close }) { return <div className="modal-backdrop"><div className="auth-modal" data-testid="subject-modal"><button className="modal-close" onClick={close}><X/></button><p className="section-label">NOVA MATÉRIA</p><h2>Crie um espaço<br/><em>para essa ideia.</em></h2><input value={subject.emoji} onChange={(e) => setSubject({ ...subject, emoji: e.target.value })} placeholder="Emoji" data-testid="subject-emoji"/><input value={subject.name} onChange={(e) => setSubject({ ...subject, name: e.target.value })} placeholder="Nome da matéria" data-testid="subject-name"/><input value={subject.desc} onChange={(e) => setSubject({ ...subject, desc: e.target.value })} placeholder="Descrição curta" data-testid="subject-description"/><button className="btn-primary full" onClick={save} data-testid="save-subject">Salvar matéria <Check size={16}/></button></div></div> }

export default App;
