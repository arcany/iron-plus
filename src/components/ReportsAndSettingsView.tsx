import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Building,
  Download,
  Save,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  CheckInRecord,
  DashboardMetrics,
  GymProfile,
  Member,
  PaymentRecord,
  SubscriptionPlan,
} from '../types/gym';
import { computeMonthlyRevenueSeries } from '../utils/gymLogic';

interface ReportsAndSettingsViewProps {
  gymProfile: GymProfile;
  metrics: DashboardMetrics;
  members: Member[];
  plans: SubscriptionPlan[];
  payments: PaymentRecord[];
  checkIns: CheckInRecord[];
  todayStr: string;
  onSaveGymProfile: (updated: GymProfile) => void;
  onResetDemoData: () => void;
}

export const ReportsAndSettingsView: React.FC<ReportsAndSettingsViewProps> = ({
  gymProfile,
  metrics,
  members,
  plans,
  payments,
  todayStr,
  onSaveGymProfile,
  onResetDemoData,
}) => {
  const [formState, setFormState] = useState<GymProfile>(gymProfile);
  const [savedNotice, setSavedNotice] = useState(false);
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const monthlySeries = useMemo(
    () => computeMonthlyRevenueSeries(payments, todayStr, 6),
    [payments, todayStr]
  );

  const currentMonthPoint = monthlySeries[monthlySeries.length - 1] || {
    monthLabel: '',
    collectedRevenue: 0,
    pendingRevenue: 0,
    invoicesCount: 0,
  };
  const previousMonthPoint = monthlySeries[monthlySeries.length - 2] || {
    monthLabel: '',
    collectedRevenue: 0,
    pendingRevenue: 0,
    invoicesCount: 0,
  };

  const momGrowthPercent =
    previousMonthPoint.collectedRevenue > 0
      ? Math.round(
          ((currentMonthPoint.collectedRevenue - previousMonthPoint.collectedRevenue) /
            previousMonthPoint.collectedRevenue) *
            100
        )
      : currentMonthPoint.collectedRevenue > 0
      ? 100
      : 0;

  const peakMonthPoint = useMemo(() => {
    if (monthlySeries.length === 0) return currentMonthPoint;
    return monthlySeries.reduce((best, item) =>
      item.collectedRevenue >= best.collectedRevenue ? item : best
    );
  }, [monthlySeries, currentMonthPoint]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGymProfile(formState);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  // Export CSV report of members & subscriptions
  const handleExportCsv = () => {
    const headers = [
      'الباركود',
      'الاسم الكامل',
      'رقم الجوال',
      'الباقة',
      'السعر',
      'تاريخ البداية',
      'تاريخ الانتهاء',
      'مرات الحضور',
    ];
    const rows = members.map((m) => [
      m.barcode,
      `"${m.fullName}"`,
      m.phone,
      `"${m.subscription.planName}"`,
      m.subscription.price,
      m.subscription.startDate,
      m.subscription.endDate,
      m.totalCheckIns,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-members-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Compute revenue per plan
  const planStats = plans.map((plan) => {
    const enrolled = members.filter((m) => m.subscription.planId === plan.id).length;
    const revenue = payments
      .filter((p) => p.planName === plan.name)
      .reduce((s, p) => s + p.paidAmount, 0);
    return {
      plan,
      enrolled,
      revenue,
    };
  });

  const maxRevenue = Math.max(1, ...planStats.map((x) => x.revenue));

  return (
    <div className="space-y-6">
      {/* Header & Export CSV */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            التقارير الإحصائية وبيانات تسجيل الجيم
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            مخطط تطور الإيرادات الشهرية، تحليل أداء الباقات، وتحديث البيانات الرسمية للصالة الرياضية
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>تصدير تقرير الأعضاء والاشتراكات (CSV)</span>
        </button>
      </div>

      {/* Recharts Monthly Revenue Progression Card */}
      <div className="rounded-xl bg-white border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
              <h2 className="text-base font-bold text-slate-900">
                مخطط تطور الإيرادات الشهرية (بناءً على سجل المدفوعات)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              يتحدث تلقائياً من جدول الفواتير والمدفوعات ويعرض الإيرادات المحصلة والمبالغ المتبقية لكل شهر
            </p>
          </div>

          {/* Interactive Chart Mode Switcher */}
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start md:self-auto"
            role="group"
            aria-label="نوع المخطط البياني"
          >
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartType === 'area'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              منحنى مساحي (Area Chart)
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartType === 'bar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              أعمدة بيانية (Bar Chart)
            </button>
          </div>
        </div>

        {/* Monthly KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-5">
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5">
            <span className="text-xs text-slate-500 block">
              إيرادات الشهر الحالي ({currentMonthPoint.monthLabel})
            </span>
            <span className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-1 block">
              {currentMonthPoint.collectedRevenue.toLocaleString('en-US')} {gymProfile.currency}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5">
            <span className="text-xs text-slate-500 block">
              إيرادات الشهر السابق ({previousMonthPoint.monthLabel})
            </span>
            <span className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1 block">
              {previousMonthPoint.collectedRevenue.toLocaleString('en-US')} {gymProfile.currency}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5">
            <span className="text-xs text-slate-500 block">معدل النمو الشهري (MoM)</span>
            <span
              className={`text-lg font-bold font-mono tabular-nums mt-1 block ${
                momGrowthPercent >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {momGrowthPercent >= 0 ? `+${momGrowthPercent}%` : `${momGrowthPercent}%`}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5">
            <span className="text-xs text-slate-500 block">
              أعلى شهر إيراداً ({peakMonthPoint.monthLabel})
            </span>
            <span className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1 block">
              {peakMonthPoint.collectedRevenue.toLocaleString('en-US')} {gymProfile.currency}
            </span>
          </div>
        </div>

        {/* Recharts Responsive Container */}
        <div
          className="w-full h-80 min-w-0 pt-2"
          data-testid="monthly-revenue-chart"
          dir="ltr"
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart
                data={monthlySeries}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v.toLocaleString('en-US')}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    direction: 'rtl',
                    textAlign: 'right',
                  }}
                  itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                  formatter={(value: number, name: string) => [
                    `${Number(value).toLocaleString('en-US')} ${gymProfile.currency}`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '12px', fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="collectedRevenue"
                  name="الإيرادات المحصلة"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCollected)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#059669' }}
                />
                <Area
                  type="monotone"
                  dataKey="pendingRevenue"
                  name="المبالغ المتبقية (الآجل)"
                  stroke="#d97706"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPending)"
                />
              </AreaChart>
            ) : (
              <BarChart
                data={monthlySeries}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v.toLocaleString('en-US')}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    direction: 'rtl',
                    textAlign: 'right',
                  }}
                  itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                  formatter={(value: number, name: string) => [
                    `${Number(value).toLocaleString('en-US')} ${gymProfile.currency}`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '12px', fontWeight: 600 }}
                />
                <Bar
                  dataKey="collectedRevenue"
                  name="الإيرادات المحصلة"
                  fill="#059669"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
                <Bar
                  dataKey="pendingRevenue"
                  name="المبالغ المتبقية (الآجل)"
                  fill="#d97706"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Monthly Breakdown Table */}
        <div className="mt-5 pt-4 border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">الشهر</th>
                <th className="py-2.5 px-3 font-semibold">عدد الفواتير</th>
                <th className="py-2.5 px-3 font-semibold">الإيرادات المحصلة</th>
                <th className="py-2.5 px-3 font-semibold">المتبقي قيد التحصيل</th>
                <th className="py-2.5 px-3 font-semibold">إجمالي قيمة الاشتراكات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlySeries.map((pt) => (
                <tr key={pt.monthKey} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{pt.monthLabel}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums">
                    {pt.invoicesCount} فاتورة
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 tabular-nums">
                    {pt.collectedRevenue.toLocaleString('en-US')} {gymProfile.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-amber-700 tabular-nums">
                    {pt.pendingRevenue.toLocaleString('en-US')} {gymProfile.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 tabular-nums">
                    {pt.totalBilled.toLocaleString('en-US')} {gymProfile.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Two-Column Grid: Revenue by Plan + Gym Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue & Subscriptions by Plan (7 cols) */}
        <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                تحليل الإيرادات والإقبال حسب باقات الاشتراك
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              الإجمالي: {metrics.totalRevenueCollected.toLocaleString('en-US')}{' '}
              {gymProfile.currency}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {planStats.map(({ plan, enrolled, revenue }) => {
              const barPercent = Math.round((revenue / maxRevenue) * 100);
              return (
                <div key={plan.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{plan.name}</span>
                    <span className="font-mono text-slate-700 tabular-nums">
                      {enrolled} مشترك ·{' '}
                      <strong className="text-emerald-700">
                        {revenue.toLocaleString('en-US')} {gymProfile.currency}
                      </strong>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(6, barPercent)}%` }}
                      className="h-full bg-emerald-600 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Operational KPIs Table */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">إجمالي حركات الحضور</span>
              <span className="font-mono font-bold text-base text-slate-900 mt-0.5 block tabular-nums">
                {members.reduce((s, m) => s + m.totalCheckIns, 0)} زيارة
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">متوسط زيارات العضو</span>
              <span className="font-mono font-bold text-base text-slate-900 mt-0.5 block tabular-nums">
                {members.length > 0
                  ? Math.round(
                      members.reduce((s, m) => s + m.totalCheckIns, 0) / members.length
                    )
                  : 0}{' '}
                زيارة
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">نسبة التحصيل الفعلي</span>
              <span className="font-mono font-bold text-base text-emerald-700 mt-0.5 block tabular-nums">
                {metrics.collectionRatePercent}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">الطاقة الاستيعابية</span>
              <span className="font-mono font-bold text-base text-slate-900 mt-0.5 block tabular-nums">
                {metrics.activeCount + metrics.expiringSoonCount} / {gymProfile.maxCapacity}
              </span>
            </div>
          </div>
        </div>

        {/* Gym Profile Registration & Settings Form (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-white border border-slate-200 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">
                بيانات الجيم وإعدادات النظام
              </h2>
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
            {savedNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تم حفظ بيانات الجيم وإعدادات النظام بنجاح!</span>
              </div>
            )}

            <div>
              <label
                htmlFor="gym-name-input"
                className="block font-semibold text-slate-700 mb-1"
              >
                اسم الجيم / النادي الرياضي
              </label>
              <input
                id="gym-name-input"
                type="text"
                value={formState.gymName}
                onChange={(e) => setFormState({ ...formState, gymName: e.target.value })}
                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="gym-branch-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  اسم الفرع
                </label>
                <input
                  id="gym-branch-input"
                  type="text"
                  value={formState.branchName}
                  onChange={(e) => setFormState({ ...formState, branchName: e.target.value })}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="gym-manager-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  المدير المسؤول
                </label>
                <input
                  id="gym-manager-input"
                  type="text"
                  value={formState.managerName}
                  onChange={(e) => setFormState({ ...formState, managerName: e.target.value })}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="gym-phone-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  رقم هاتف الجيم
                </label>
                <input
                  id="gym-phone-input"
                  type="text"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="gym-currency-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  العملة المعتمدة
                </label>
                <select
                  id="gym-currency-input"
                  value={formState.currency}
                  onChange={(e) => setFormState({ ...formState, currency: e.target.value })}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                >
                  <option value="ج.م">جنيه مصري (ج.م)</option>
                  <option value="ر.س">ريال سعودي (ر.س)</option>
                  <option value="د.إ">درهم إماراتي (د.إ)</option>
                  <option value="د.ك">دينار كويتي (د.ك)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="gym-hours-input"
                className="block font-semibold text-slate-700 mb-1"
              >
                مواعيد العمل الرسمية
              </label>
              <input
                id="gym-hours-input"
                type="text"
                value={formState.workingHours}
                onChange={(e) => setFormState({ ...formState, workingHours: e.target.value })}
                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900"
              />
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onResetDemoData}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة البيانات الافتراضية</span>
              </button>

              <button
                type="submit"
                className="min-h-[40px] px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>حفظ بيانات الجيم</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
