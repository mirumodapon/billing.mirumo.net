import {
  IconBallFootball,
  IconBeach,
  IconBed,
  IconBeer,
  IconBike,
  IconBuildingCottage,
  IconBus,
  IconCake,
  IconCamera,
  IconCar,
  IconCoffee,
  IconCoin,
  IconCup,
  IconDots,
  IconGasStation,
  IconGift,
  IconHome,
  IconIceCream,
  IconMedicalCross,
  IconMountain,
  IconMovie,
  IconMusic,
  IconParking,
  IconPerfume,
  IconPhone,
  IconPlane,
  IconReceipt,
  IconShip,
  IconShirt,
  IconShoppingBag,
  IconShoppingCart,
  IconTent,
  IconTicket,
  IconToolsKitchen2,
  IconTrain,
  IconWash,
  IconWifi,
} from '@tabler/icons-react'

/**
 * 類別圖示白名單（規格 13.6）。同時是內建類別的來源與自訂類別選擇器的清單。
 *
 * 選擇器要全部顯示，所以全部進 bundle 是必要的。新增圖示只改這個檔案，
 * CategoryIconName 與選擇器自動跟上。分組順序即選擇器裡的顯示順序。
 */
export const CATEGORY_ICONS = {
  // 餐飲
  IconToolsKitchen2,
  IconCoffee,
  IconBeer,
  IconCup,
  IconCake,
  IconIceCream,
  // 交通
  IconCar,
  IconPlane,
  IconTrain,
  IconBus,
  IconBike,
  IconShip,
  IconGasStation,
  IconParking,
  // 住宿
  IconBed,
  IconHome,
  IconBuildingCottage,
  IconTent,
  // 購物
  IconShoppingBag,
  IconShoppingCart,
  IconGift,
  IconShirt,
  IconPerfume,
  // 娛樂
  IconTicket,
  IconCamera,
  IconMountain,
  IconBeach,
  IconMovie,
  IconMusic,
  IconBallFootball,
  // 雜項
  IconMedicalCross,
  IconWifi,
  IconPhone,
  IconWash,
  IconReceipt,
  IconCoin,
  IconDots,
} as const

export type CategoryIconName = keyof typeof CATEGORY_ICONS
