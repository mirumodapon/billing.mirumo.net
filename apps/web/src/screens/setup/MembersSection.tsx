import type { Member, Trip } from '@billing/core'
import { Accordion, Avatar, Button, ChipGroup, Icon, pickAccent, TextField } from '@billing/ui'
import { IconTrash, IconUserPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { MemberInUseError } from '../../data/errors'
import { useI18n } from '../../i18n/useI18n'
import { useConfirmDelete } from '../forms/useConfirmDelete'

export interface MembersSectionProps {
  trip: Trip
  open: boolean
  onToggle: () => void
  save: (change: (t: Trip) => Trip) => Promise<Trip | undefined>
}

/**
 * 成員與「我是誰」（規格 4.7）。
 *
 * 身分色永遠與名字一起出現（規格 5.8）：頭像帶名字首字，旁邊是完整的名字。
 * 移除仍被帳目引用的成員時，資料層擋下（task#61），這裡說出是誰、為什麼。
 */
export function MembersSection({ trip, open, onToggle, save }: MembersSectionProps) {
  const { t, tPlural, locale } = useI18n()
  const [newName, setNewName] = useState('')
  const [inUse, setInUse] = useState<string[]>([])
  const confirm = useConfirmDelete()

  const add = () => {
    const name = newName.trim()
    if (!name) return
    const colorKey = pickAccent(trip.members.map((m) => m.colorKey))
    setNewName('')
    void save((x) => ({ ...x, members: [...x.members, { id: crypto.randomUUID(), name, colorKey }] }))
  }

  const remove = async (member: Member) => {
    setInUse([])
    try {
      await save((x) => ({ ...x, members: x.members.filter((m) => m.id !== member.id) }))
    } catch (error) {
      if (!(error instanceof MemberInUseError)) throw error
      setInUse([...error.memberIds])
    }
  }

  const nameOf = (id: string) => trip.members.find((m) => m.id === id)?.name ?? id
  const inUseNames = new Intl.ListFormat(locale, { type: 'conjunction' }).format(inUse.map(nameOf))

  return (
    <Accordion
      title={t('members.title')}
      summary={tPlural('members.count', { count: trip.members.length })}
      open={open}
      onToggle={onToggle}
      data-testid="section-members"
    >
      <div className="app-form">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {trip.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.id === trip.selfMemberId}
              onRename={(name) => void save((x) => ({ ...x, members: x.members.map((m) => (m.id === member.id ? { ...m, name } : m)) }))}
              onRemove={() => confirm.ask(member.name, 'permanent', () => void remove(member))}
            />
          ))}
        </ul>
        {inUse.length > 0 ? (
          <p role="alert" className="app-error">
            {t('members.inUse', { names: inUseNames })}
          </p>
        ) : null}
        {/* 與成員列同一個版面（task#103）：頭像的位置放新增圖示，新增鍵在框內右側 */}
        <div className="flex items-center gap-3">
          <span className="app-avatar-slot" aria-hidden="true">
            <Icon glyph={IconUserPlus} />
          </span>
          <div className="min-w-0 flex-1">
            <TextField
              label={t('members.newName')}
              hideLabel
              placeholder={t('members.newName')}
              value={newName}
              onChange={setNewName}
              trailing={
                <Button variant="ghost" onClick={add}>
                  {t('members.add')}
                </Button>
              }
            />
          </div>
        </div>
        <div>
          <p className="app-field-label">{t('members.self')}</p>
          <ChipGroup
            ariaLabel={t('members.self')}
            value={trip.selfMemberId}
            options={trip.members.map((m) => ({ value: m.id, label: m.name, colorKey: m.colorKey }))}
            onChange={(id) => void save((x) => ({ ...x, selfMemberId: id }))}
          />
        </div>
        {confirm.dialog}
      </div>
    </Accordion>
  )
}

interface MemberRowProps {
  member: Member
  isSelf: boolean
  onRename: (name: string) => void
  onRemove: () => void
}

function MemberRow({ member, isSelf, onRename, onRemove }: MemberRowProps) {
  const { t } = useI18n()
  const [name, setName] = useState(member.name)
  const commit = () => {
    const trimmed = name.trim()
    // 空白名字不存，欄位還原成原本的名字：沒有名字的成員在分攤畫面上無從辨認
    if (!trimmed) setName(member.name)
    else if (trimmed !== member.name) onRename(trimmed)
  }
  return (
    // 頭像 + 整列寬的名稱框，「我」或刪除鍵在框內右側（task#103、#104）
    <li className="flex items-center gap-3">
      <Avatar name={member.name} colorKey={member.colorKey} />
      <div className="min-w-0 flex-1">
        <TextField
          label={t('members.name', { name: member.name })}
          hideLabel
          value={name}
          onChange={setName}
          onBlur={commit}
          trailing={
            // 「我」永遠在：不能移除自己，所以也不會移除到剩零人
            isSelf ? (
              <span className="px-2">{t('members.selfBadge')}</span>
            ) : (
              <Button variant="ghost" aria-label={t('members.remove', { name: member.name })} onClick={onRemove}>
                <Icon glyph={IconTrash} />
              </Button>
            )
          }
        />
      </div>
    </li>
  )
}
