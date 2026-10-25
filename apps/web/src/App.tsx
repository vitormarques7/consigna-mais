import { useRef, useState, type FormEvent } from 'react';
import { IMaskInput } from 'react-imask';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  FileText,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import {
  exampleInput,
  simulationInputSchema,
  simulationResponseSchema,
  type SimulationResponse,
} from '@consigna/contracts';
import { toCents } from './money';
import { cpfMask, cnpjMask, moneyMask, formatPastedMoney } from './input-masks';
import { ResultCard } from './ResultCard';
const initial = {
  name: '',
  email: '',
  cpf: '',
  employerCnpj: '',
  salary: '',
  amount: '',
  installments: '24',
};
type Fields = typeof initial;
export function App() {
  const [fields, setFields] = useState<Fields>(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [failure, setFailure] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  function update(key: keyof Fields, value: string) {
    if (fields[key] === value) return;
    setFields((previous) => ({ ...previous, [key]: value }));
    setResult(null);
    setFailure('');
    setErrors({});
  }
  function useExample() {
    setFields({
      name: exampleInput.name,
      email: exampleInput.email,
      cpf: '529.982.247-25',
      employerCnpj: '11.222.333/0001-81',
      salary: '5.000,00',
      amount: '15.000,00',
      installments: '24',
    });
    setErrors({});
    setFailure('');
    setResult(null);
    setAnnouncement('Dados fictícios preenchidos. Você já pode simular.');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    setFailure('');
    setResult(null);
    const input = simulationInputSchema.safeParse({
      name: fields.name,
      email: fields.email,
      cpf: fields.cpf,
      employerCnpj: fields.employerCnpj,
      salaryCents: toCents(fields.salary),
      amountCents: toCents(fields.amount),
      installments: Number(fields.installments),
    });
    if (!input.success) {
      setErrors(input.error.flatten().fieldErrors);
      setAnnouncement('Revise os campos indicados.');
      const firstError = input.error.issues[0]?.path[0];
      const id =
        firstError === 'salaryCents'
          ? 'salary'
          : firstError === 'amountCents'
            ? 'amount'
            : String(firstError);
      requestAnimationFrame(() => document.getElementById(id)?.focus());
      return;
    }
    setErrors({});
    setLoading(true);
    pending.current = true;
    setAnnouncement('Consultando os dois bancos.');
    try {
      const response = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input.data),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('request_failed');
      const data = simulationResponseSchema.parse(await response.json());
      setResult(data);
      setAnnouncement('Consulta concluída. Confira os resultados por banco.');
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch {
      setFailure(
        'Não conseguimos concluir sua consulta. Confira sua conexão e tente novamente. Seus dados continuam no formulário.',
      );
      setAnnouncement('Não foi possível concluir a consulta.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  function field(
    key: keyof Fields,
    label: string,
    placeholder: string,
    options: { type?: string; inputMode?: 'email' | 'decimal' | 'numeric'; errorKey?: string } = {},
  ) {
    const error = errors[options.errorKey ?? key]?.[0];
    const currency = key === 'salary' || key === 'amount';
    const mask =
      key === 'cpf' ? cpfMask : key === 'employerCnpj' ? cnpjMask : currency ? moneyMask : null;
    const inputProps = {
      id: key,
      name: key,
      value: fields[key],
      placeholder,
      inputMode: options.inputMode,
      autoComplete: key === 'name' ? 'name' : key === 'email' ? 'email' : 'off',
      required: true,
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `${key}-error` : undefined,
      disabled: loading,
    };
    return (
      <div className={`field ${key === 'name' ? 'full' : ''}`}>
        <label htmlFor={key}>
          {label} <span aria-hidden="true">*</span>
        </label>
        {mask ? (
          <IMaskInput
            {...inputProps}
            {...mask}
            type="text"
            unmask={false}
            onAccept={(value) => update(key, value)}
            onPaste={(event) => {
              if (!currency) return;
              const input = event.currentTarget;
              // Partial pastes use the mask's normal selection/cursor behavior.
              if (input.selectionStart !== 0 || input.selectionEnd !== input.value.length) return;
              event.preventDefault();
              const value = formatPastedMoney(event.clipboardData.getData('text'));
              if (value !== null) update(key, value);
            }}
          />
        ) : (
          <input
            {...inputProps}
            type={options.type ?? 'text'}
            onChange={(event) => update(key, event.target.value)}
            maxLength={key === 'name' ? 120 : 254}
          />
        )}
        {error && (
          <span className="field-error" id={`${key}-error`}>
            {error}
          </span>
        )}
      </div>
    );
  }
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Consigna Mais, início">
          <span className="brand-icon">
            c<Plus size={13} />
          </span>
          <span>
            consigna<span className="purple">mais</span>
          </span>
        </a>
        <nav>
          <span className="demo-pill">
            <span />
            Ambiente de demonstração
          </span>
          <a href="#como-funciona">
            Como funciona <ArrowUpRight size={17} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> CRÉDITO COM MAIS CLAREZA
            </p>
            <h1>
              Seu próximo passo
              <br />
              começa com uma <em>boa comparação.</em>
            </h1>
            <p className="hero-description">
              Simule seu empréstimo consignado e entenda, em um só lugar, como cada instituição
              avaliaria sua solicitação.
            </p>
            <div className="hero-benefits">
              <Sparkles size={18} />
              <span>Gratuito</span>
              <i /> <span>Sem compromisso</span>
              <i />
              <span>Resultados por banco</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="coin">
              <span>R$</span>
              <div className="bars">
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="float-card float-top">
              <span className="float-icon">
                <ArrowUpRight />
              </span>
              <div>
                <small>Mais possibilidades</small>
                <strong>Compare propostas</strong>
              </div>
            </div>
            <div className="float-card float-bottom">
              <span className="float-icon green">
                <Check />
              </span>
              <div>
                <small>Decisão com clareza</small>
                <strong>Veja cada resultado</strong>
              </div>
            </div>
          </div>
        </section>
        <section className="simulation" id="simular" aria-labelledby="simulation-title">
          <div className="section-top">
            <div>
              <p className="eyebrow">01 / SUA SIMULAÇÃO</p>
              <h2 id="simulation-title">Vamos começar?</h2>
              <p>Preencha os dados para consultar as condições simuladas.</p>
            </div>
            <button
              type="button"
              className="example-button"
              onClick={useExample}
              disabled={loading}
            >
              <Sparkles size={17} />
              Usar dados de exemplo
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
          <div className="simulation-grid">
            <form onSubmit={submit} noValidate>
              <section className="form-card">
                <div className="card-title">
                  <span className="step">01</span>
                  <div>
                    <h3>Dados pessoais</h3>
                    <p>Informações de quem solicita a simulação.</p>
                  </div>
                  <span className="title-decoration" />
                </div>
                <div className="fields">
                  {field('name', 'Nome completo', 'Como você se chama?')}
                  {field('email', 'E-mail', 'voce@exemplo.com', {
                    type: 'email',
                    inputMode: 'email',
                  })}
                  {field('cpf', 'CPF', '000.000.000-00', { inputMode: 'numeric' })}
                </div>
              </section>
              <section className="form-card">
                <div className="card-title">
                  <span className="step">02</span>
                  <div>
                    <h3>Vínculo e renda</h3>
                    <p>Seu ponto de partida para a análise.</p>
                  </div>
                  <Landmark className="muted-purple" size={21} />
                </div>
                <div className="fields">
                  {field('employerCnpj', 'CNPJ do empregador', '00.000.000/0000-00')}
                  {field('salary', 'Salário mensal (R$)', '5.000,00', {
                    inputMode: 'decimal',
                    errorKey: 'salaryCents',
                  })}
                </div>
              </section>
              <section className="form-card">
                <div className="card-title">
                  <span className="step">03</span>
                  <div>
                    <h3>Seu próximo passo</h3>
                    <p>Escolha o valor e o prazo que deseja simular.</p>
                  </div>
                  <ArrowUpRight className="muted-purple" size={22} />
                </div>
                <div className="fields">
                  {field('amount', 'Valor solicitado (R$)', '15.000,00', {
                    inputMode: 'decimal',
                    errorKey: 'amountCents',
                  })}
                  <div className="field">
                    <label htmlFor="installments">
                      Prazo <span aria-hidden="true">*</span>
                    </label>
                    <select
                      id="installments"
                      value={fields.installments}
                      onChange={(event) => update('installments', event.target.value)}
                      disabled={loading}
                    >
                      <option value="12">12 meses</option>
                      <option value="24">24 meses</option>
                      <option value="36">36 meses</option>
                    </select>
                  </div>
                </div>
                <div className="simulation-note">
                  <ShieldCheck size={18} />
                  <p>
                    Use apenas dados fictícios. Esta demonstração não contrata crédito e não salva
                    suas informações.
                  </p>
                </div>
                <button className="submit-button" disabled={loading}>
                  {loading ? (
                    <>
                      <LoaderCircle className="spin" size={19} />
                      Consultando os bancos...
                    </>
                  ) : (
                    <>
                      Comparar condições <ArrowRight size={19} />
                    </>
                  )}
                </button>
                <p className="button-caption">
                  <LockKeyhole size={12} />
                  Sem cadastro. Sem compromisso.
                </p>
              </section>
            </form>
            <aside className="results-panel" aria-busy={loading}>
              <div className="results-heading">
                <div>
                  <p className="eyebrow">02 / RESULTADOS</p>
                  <h2 ref={resultHeading} tabIndex={-1}>
                    Sua análise
                  </h2>
                </div>
                <span className="step">
                  <Sparkles size={19} />
                </span>
              </div>
              {loading ? (
                <div className="empty-state">
                  <div className="empty-illustration">
                    <LoaderCircle size={52} className="spin" />
                  </div>
                  <h3>Buscando suas possibilidades</h3>
                  <p>
                    Estamos consultando as duas instituições. Cada uma tem seus próprios critérios.
                  </p>
                </div>
              ) : failure ? (
                <div className="empty-state">
                  <TriangleAlert size={40} />
                  <h3>Vamos tentar de novo?</h3>
                  <p role="alert">{failure}</p>
                  <button
                    className="example-button"
                    onClick={() => document.getElementById('name')?.focus()}
                  >
                    <RefreshCw size={16} />
                    Revisar e tentar novamente
                  </button>
                </div>
              ) : result ? (
                <div className="result-list">
                  <p className="result-intro">Uma resposta de cada banco, com clareza.</p>
                  {result.results.map((bank) => (
                    <ResultCard key={bank.bankId} result={bank} />
                  ))}
                  <p className="result-footnote">
                    Taxas e critérios fictícios. Os valores não incluem impostos, tarifas ou
                    seguros. Não representam uma oferta real. Demonstração sem vínculo com os
                    bancos.
                  </p>
                  <span className="request-id">Consulta {result.requestId.slice(0, 8)}</span>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-illustration">
                    <span className="paper-back" />
                    <span className="paper-front">
                      <FileText size={64} strokeWidth={1.2} />
                      <ArrowUpRight size={28} />
                    </span>
                  </div>
                  <h3>O resultado vem depois dos dados.</h3>
                  <p>Preencha o formulário para comparar as possibilidades de cada instituição.</p>
                  <span className="empty-label">
                    <ArrowDown size={14} />
                    Seu próximo passo começa ao lado
                  </span>
                </div>
              )}
              <div className="results-bottom">
                <CircleHelp size={17} />
                <p>
                  Uma indisponibilidade significa que o banco não respondeu à consulta. Você pode
                  tentar novamente.
                </p>
              </div>
            </aside>
          </div>
        </section>
        <section id="como-funciona" className="how">
          <p className="eyebrow">SIMPLES DO INÍCIO AO FIM</p>
          <h2>Três passos. Mais clareza.</h2>
          <div className="how-grid">
            {[
              [
                '01',
                'Conte um pouco sobre você',
                'Preencha os dados fictícios e escolha o valor e o prazo.',
              ],
              [
                '02',
                'Consultamos os bancos',
                'Duas instituições simuladas avaliam sua solicitação de forma independente.',
              ],
              [
                '03',
                'Entenda as possibilidades',
                'Veja as condições aprovadas e os motivos de cada resultado.',
              ],
            ].map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <a className="brand small" href="#">
          consigna<span className="purple">mais</span>
        </a>
        <p>Uma demonstração de crédito com mais clareza.</p>
        <span>Projeto educacional · Dados fictícios</span>
      </footer>
    </>
  );
}
