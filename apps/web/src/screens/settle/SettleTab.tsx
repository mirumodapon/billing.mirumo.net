import { convertToBaseMinor, decimalsOf, fromMinor, toMinor, type Transfer, type Trip } from '@billing/core'
import { Avatar, Button, Chip, Icon, SwipeAction } from '@billing/ui'
import { IconPlus, IconShare, IconTrash } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { settlementView, shareText, signedMoney, type PendingTransfer } from '../../domain/settlement'
import { useI18n } from '../../i18n/useI18n'
import { useStores, useTrips } from '../../stores/StoresProvider'
import { useConfirmDelete } from '../forms/useConfirmDelete'
import { shareSettlement } from './shareSettlement'

/**
 * 結算（規格 4.6，tab 3）：由上而下回答三個問題——現在誰欠誰、已經發生過什麼、還要怎麼付。
 * 每次從原始資料重算，不做快取（規格 7.5）。
 */
export function SettleTab() {
  const { tripId = '' } = useParams()
  const trip = useTrips((s) => s.trips.find((x) => x.id === tripId))
  const current = useTrips((s) => (s.current?.tripId === tripId ? s.current : undefined))
  if (!trip || !current) return null
  return <Settlement trip={trip} expenses={current.expenses} transfers={current.transfers} />
}

function Settlement({ trip, expenses, transfers }: { trip: Trip; expenses: Parameters<typeof settlementView>[1]; transfers: Transfer[] }) {
  const { t, money } = useI18n()
  const navigate = useNavigate()
  const { trips, ui } = useStores()
  const view = useMemo(() => settlementView(trip, expenses, transfers), [trip, expenses, transfers])
  const status = { receive: t('settle.receive'), pay: t('settle.pay'), settled: t('settle.settled') }
  const confirm = useConfirmDelete()
  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? id

  // 規格 4.6：「已結清」不是打勾，而是開出預填好的轉帳表單，存成一筆真的紀錄
  const settle = (p: PendingTransfer) => {
    const amount = fromMinor(p.amountMinor, decimalsOf(trip.baseCurrency))
    navigate(`/trip/${trip.id}/transfer/new?from=${p.from}&to=${p.to}&amount=${amount}&kind=settlement`)
  }

  const share = async () => {
    const outcome = await shareSettlement(t('settle.shareTitle', { trip: trip.name }), shareText(trip, view, t, money))
    if (outcome === 'copied') ui.getState().show({ id: 'settle-share', message: t('settle.copied') })
    if (outcome === 'failed') ui.getState().show({ id: 'settle-share', message: t('settle.shareFailed') })
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      <section aria-labelledby="settle-balances" className="flex flex-col gap-2">
        <h2 id="settle-balances" className="app-card__title">
          {t('settle.balances')}
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {view.balances.map((b) => {
            const member = trip.members.find((m) => m.id === b.memberId)
            return (
              <li key={b.memberId} className="flex items-center gap-3" data-testid={`balance-${b.memberId}`}>
                <Avatar name={b.name} colorKey={member?.colorKey} size="sm" />
                <span className="flex-1">{b.name}</span>
                <span className="app-money">{signedMoney(b.netMinor, trip.baseCurrency, money)}</span>
                {/* 狀態永遠有文字：顏色不是唯一的辨識方式 */}
                <span className="app-field-label m-0 w-14 text-end">{status[b.status]}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="settle-transfers" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 id="settle-transfers" className="app-card__title">
            {t('settle.transfers')}
          </h2>
          <Button variant="ghost" aria-label={t('transfer.new')} onClick={() => navigate(`/trip/${trip.id}/transfer/new`)}>
            <Icon glyph={IconPlus} />
          </Button>
        </div>
        {transfers.length === 0 ? <p className="app-field-label">{t('settle.noTransfers')}</p> : null}
        {transfers.map((x) => (
          <TransferRow
            key={x.id}
            trip={trip}
            transfer={x}
            onOpen={() => navigate(`/trip/${trip.id}/transfer/${x.id}`)}
            onDelete={() => confirm.ask(`${memberName(x.from)} → ${memberName(x.to)}`, 'undoable', () => void trips.getState().deleteTransfer(x.id))}
          />
        ))}
      </section>

      <section aria-labelledby="settle-pending" className="flex flex-col gap-2">
        <h2 id="settle-pending" className="app-card__title">
          {t('settle.pending')}
        </h2>
        {view.pending.length === 0 ? <p className="app-field-label">{t('settle.allSettled')}</p> : null}
        {view.pending.map((p) => (
          <div key={`${p.from}-${p.to}`} className="app-card flex-row items-center justify-between" data-testid="pending">
            <span>
              {p.fromName} → {p.toName} <span className="app-money">{money(p.amountMinor, trip.baseCurrency)}</span>
            </span>
            <Button variant="secondary" onClick={() => settle(p)}>
              {t('settle.markSettled')}
            </Button>
          </div>
        ))}
      </section>

      <Button variant="secondary" onClick={() => void share()}>
        <span className="inline-flex items-center gap-2">
          <Icon glyph={IconShare} />
          {t('settle.share')}
        </span>
      </Button>
      {confirm.dialog}
    </div>
  )
}

function TransferRow({ trip, transfer, onOpen, onDelete }: { trip: Trip; transfer: Transfer; onOpen: () => void; onDelete: () => void }) {
  const { t, money, date } = useI18n()
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? id
  const foreign = transfer.currency !== trip.baseCurrency
  const original = money(toMinor(transfer.amount, decimalsOf(transfer.currency)), transfer.currency)
  // 草稿可能還沒有匯率（存成 0）：那時只顯示原幣
  const base = transfer.exchangeRate > 0 ? money(convertToBaseMinor(transfer.amount, transfer.exchangeRate, trip.baseCurrency), trip.baseCurrency) : undefined
  return (
    <SwipeAction glyph={IconTrash} actionLabel={t('common.delete')} onAction={onDelete}>
      <button type="button" className="app-expense" onClick={onOpen}>
        <span className="app-expense__body">
          <span>
            {date(transfer.date)} · {name(transfer.from)} → {name(transfer.to)}
            {transfer.draft ? (
              <>
                {' '}
                <Chip label={t('record.draft')} />
              </>
            ) : null}
          </span>
          <span className="app-field-label m-0">
            {[t(`transfer.${transfer.kind}`), transfer.note].filter(Boolean).join('・')}
          </span>
        </span>
        <span className="app-expense__amounts">
          <span className="block">{!base ? original : foreign ? `${original} ≈ ${base}` : base}</span>
        </span>
      </button>
    </SwipeAction>
  )
}
