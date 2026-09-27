import { BasicInfoSection } from './BasicInfoSection'
import { BudgetSection } from './BudgetSection'
import { DeleteTripSection } from './DeleteTripSection'
import { MembersSection } from './MembersSection'
import { RatesSection } from './RatesSection'
import { useOpenSection } from './useOpenSection'
import { useTripEditor } from './useTripEditor'

/** 旅程設定（規格 4.7）：各區塊各自收折，一次展開一個 */
export function SetupTab() {
  const { trip, save, hasRecords } = useTripEditor()
  const { open, toggle } = useOpenSection()
  if (!trip) return null
  return (
    // key：換旅程時各區塊的本地草稿（輸入到一半的名稱）要重來
    <div key={trip.id} data-testid="setup-tab" className="flex flex-col gap-2 p-4">
      <BasicInfoSection trip={trip} hasRecords={hasRecords} open={open === 'basic'} onToggle={() => toggle('basic')} save={save} />
      <MembersSection trip={trip} open={open === 'members'} onToggle={() => toggle('members')} save={save} />
      <BudgetSection trip={trip} open={open === 'budget'} onToggle={() => toggle('budget')} save={save} />
      <RatesSection trip={trip} open={open === 'rates'} onToggle={() => toggle('rates')} save={save} />
      <DeleteTripSection trip={trip} open={open === 'delete'} onToggle={() => toggle('delete')} />
    </div>
  )
}
