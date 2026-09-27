import { describe, expect, it } from 'vitest'
import { CATEGORY_ICONS } from './categoryIcons'

/*
 * 逐字釘住規格 13.6 的清單。其他測試都是「遍歷白名單的每一項檢查它合格」，
 * 少一項只是少跑一輪，照樣全綠——所以必須另外有一條說「該有的都在」。
 * 這份清單同時是內建類別的來源，少了 IconToolsKitchen2 就少了「餐飲」。
 */
const EXPECTED = [
  'IconToolsKitchen2', 'IconCoffee', 'IconBeer', 'IconCup', 'IconCake', 'IconIceCream',
  'IconCar', 'IconPlane', 'IconTrain', 'IconBus', 'IconBike', 'IconShip', 'IconGasStation', 'IconParking',
  'IconBed', 'IconHome', 'IconBuildingCottage', 'IconTent',
  'IconShoppingBag', 'IconShoppingCart', 'IconGift', 'IconShirt', 'IconPerfume',
  'IconTicket', 'IconCamera', 'IconMountain', 'IconBeach', 'IconMovie', 'IconMusic', 'IconBallFootball',
  'IconMedicalCross', 'IconWifi', 'IconPhone', 'IconWash', 'IconReceipt', 'IconCoin', 'IconDots',
]

describe('CATEGORY_ICONS', () => {
  it('lists exactly the icons the spec names, in order', () => {
    expect(Object.keys(CATEGORY_ICONS)).toEqual(EXPECTED)
  })

  // 名字拼錯的話 import 會是 undefined，而物件照樣建得出來
  it('maps every name to a real component', () => {
    for (const [name, glyph] of Object.entries(CATEGORY_ICONS)) {
      expect(glyph, `${name} is not a component`).toBeTruthy()
      expect(['function', 'object'], `${name} is not a component`).toContain(typeof glyph)
    }
  })

  it('contains the six built-in category icons', () => {
    for (const name of ['IconToolsKitchen2', 'IconCar', 'IconBed', 'IconShoppingBag', 'IconTicket', 'IconDots']) {
      expect(Object.keys(CATEGORY_ICONS)).toContain(name)
    }
  })
})
