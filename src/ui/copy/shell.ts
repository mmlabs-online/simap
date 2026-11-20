import type { NavId } from "@/lib/nav";
import type { Tier } from "@/lib/tier";

/** Vietnamese strings for the app shell and the route skeletons. */
export const shellCopy = {
  brand: "simap",
  navLabel: "Điều hướng chính",
  skipLink: "Bỏ qua đến nội dung chính",
  nav: {
    dashboard: "Tổng quan",
    rooms: "Phòng",
    devices: "Thiết bị",
    members: "Thành viên",
    approvals: "Phê duyệt",
    roomEditor: "Chỉnh sơ đồ phòng",
  } satisfies Record<NavId, string>,
  tiers: {
    user: "Người dùng",
    manager: "Quản lý",
    admin: "Quản trị",
  } satisfies Record<Tier, string>,
  actions: {
    switchOrg: "Chuyển tổ chức",
    refreshPermissions: "Làm mới quyền",
    signOut: "Đăng xuất",
    toggleTheme: "Chuyển giao diện sáng/tối",
  },
  signedOut: {
    title: "Chưa đăng nhập",
    body: "Đăng nhập bằng tài khoản mmlabs để tiếp tục.",
    signIn: "Đăng nhập",
  },
  pages: {
    dashboard: { title: "Tổng quan", empty: "Chưa có dữ liệu." },
    rooms: { title: "Phòng", empty: "Chưa có phòng nào." },
    roomDetail: { title: "Chi tiết phòng", empty: "Chưa có dữ liệu." },
    roomEditor: { title: "Chỉnh sơ đồ phòng", empty: "Chưa có dữ liệu." },
    members: { title: "Thành viên", empty: "Chưa có thành viên nào." },
    devices: { title: "Thiết bị", empty: "Chưa có thiết bị nào." },
    approvals: { title: "Phê duyệt", empty: "Không có yêu cầu nào đang chờ." },
  },
} as const;
