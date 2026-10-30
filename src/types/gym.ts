export type SubscriptionStatus = 'active' | 'expiring_soon' | 'expired' | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface GymProfile {
  gymName: string;
  branchName: string;
  managerName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  workingHours: string;
  alertThresholdDays: number;
  maxCapacity: number;
  commercialRegNo: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  category: string;
  durationDays: number;
  price: number;
  description: string;
  features: string[];
  freezeDaysAllowed: number;
  invitationsCount: number;
  active: boolean;
}

export interface MemberSubscription {
  planId: string;
  planName: string;
  price: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  cancelledAt?: string;
  cancelReason?: string;
  trainerName?: string;
}

export interface Member {
  id: string;
  barcode: string; // e.g. GYM-1001
  fullName: string;
  phone: string;
  email?: string;
  nationalId?: string;
  gender: 'male' | 'female';
  age: number;
  weightKg?: number;
  heightCm?: number;
  goal: string;
  emergencyPhone?: string;
  joinDate: string; // YYYY-MM-DD
  notes?: string;
  subscription: MemberSubscription;
  totalCheckIns: number;
  lastCheckIn?: string; // ISO string or YYYY-MM-DD HH:mm
}

export interface CheckInRecord {
  id: string;
  memberId: string;
  memberName: string;
  barcode: string;
  planName: string;
  timestamp: string; // YYYY-MM-DD HH:mm
  date: string;      // YYYY-MM-DD
  statusAtEntry: SubscriptionStatus;
  allowed: boolean;
  remainingDays: number;
  reason: string;
}

export interface PaymentRecord {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  barcode: string;
  planName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  method: PaymentMethod;
  date: string; // YYYY-MM-DD
  type: 'new_subscription' | 'renewal' | 'installment';
  notes?: string;
}

export interface GymAlert {
  id: string;
  memberId: string;
  memberName: string;
  barcode: string;
  phone: string;
  planName: string;
  endDate: string;
  remainingDays: number;
  alertType: 'expiring_soon' | 'expired';
  isRead: boolean;
  notified: boolean;
}

export interface ComputedSubscriptionState {
  status: SubscriptionStatus;
  remainingDays: number;
  totalDays: number;
  elapsedDays: number;
  progressPercent: number;
}

export interface CheckInEvaluation {
  found: boolean;
  allowed: boolean;
  barcode: string;
  member?: Member;
  subscriptionState?: ComputedSubscriptionState;
  status?: SubscriptionStatus;
  remainingDays: number;
  messageTitle: string;
  messageDetail: string;
}

export interface DashboardMetrics {
  totalMembers: number;
  activeCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  cancelledCount: number;
  todayCheckInsCount: number;
  todayDeniedCount: number;
  totalRevenueCollected: number;
  totalPendingBalance: number;
  collectionRatePercent: number;
}

export interface MonthlyRevenuePoint {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. أكتوبر 2026
  shortMonth: string; // e.g. أكتوبر
  collectedRevenue: number;
  pendingRevenue: number;
  totalBilled: number;
  invoicesCount: number;
}

