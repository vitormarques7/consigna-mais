import { CheckCircle2, XCircle, TriangleAlert, Landmark } from 'lucide-react';
import type { BankResult } from '@consigna/contracts';
import { brl } from './money';
export function ResultCard({ result }: { result: BankResult }) {
  const Icon =
    result.status === 'approved'
      ? CheckCircle2
      : result.status === 'rejected'
        ? XCircle
        : TriangleAlert;
  return (
    <article className={`bank-card ${result.status}`}>
      <div className="bank-heading">
        <span className="bank-icon">
          <Landmark size={19} />
        </span>
        <strong>{result.bankName}</strong>
      </div>
      <span className="status">
        <Icon size={15} />
        {result.status === 'approved'
          ? 'Simulação aprovada'
          : result.status === 'rejected'
            ? 'Não aprovado'
            : 'Banco indisponível'}
      </span>
      {result.status === 'approved' ? (
        <>
          <p className="payment">
            {brl(result.offer.installmentCents)} <span>/ mês</span>
          </p>
          <dl>
            <div>
              <dt>Prazo</dt>
              <dd>{result.offer.installments} meses</dd>
            </div>
            <div>
              <dt>Taxa mensal fictícia</dt>
              <dd>{result.offer.monthlyRatePercent.toLocaleString('pt-BR')}%</dd>
            </div>
            <div>
              <dt>Total estimado</dt>
              <dd>{brl(result.offer.totalCents)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="bank-message">{result.message}</p>
      )}
    </article>
  );
}
