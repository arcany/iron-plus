import React, { useState } from 'react';
import { Plus, Check, Calendar, Users, Trash2, Power } from 'lucide-react';
import { GymProfile, Member, SubscriptionPlan } from '../types/gym';

interface PlansViewProps {
  gymProfile: GymProfile;
  plans: SubscriptionPlan[];
  members: Member[];
  onAddPlan: (plan: Omit<SubscriptionPlan, 'id'>) => void;
  onTogglePlanActive: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
}

export const PlansView: React.FC<PlansViewProps> = ({
  gymProfile,
  plans,
  members,
  onAddPlan,
  onTogglePlanActive,
  onDeletePlan,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('كمال أجسام ولياقة');
  const [durationDays, setDurationDays] = useState('30');
  const [price, setPrice] = useState('900');
  const [description, setDescription] = useState('');
  const [featuresText, setFeaturesText] = useState(
    'دخول يومي لصالة الحديد والكارديو\nقياس InBody مجاني\nمتابعة برنامج تدريبي'
  );
  const [freezeDaysAllowed, setFreezeDaysAllowed] = useState('7');
  const [invitationsCount, setInvitationsCount] = useState('2');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم خطة الاشتراك.');
      return;
    }
    const numDays = Number(durationDays);
    const numPrice = Number(price);
    if (isNaN(numDays) || numDays < 1) {
      setError('يرجى تحديد مدة الاشتراك بالأيام (يوم واحد على الأقل).');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('يرجى تحديد سعر الاشتراك بشكل صحيح.');
      return;
    }

    setError('');
    const features = featuresText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    onAddPlan({
      name: name.trim(),
      category: category.trim() || 'عام',
      durationDays: numDays,
      price: numPrice,
      description:
        description.trim() ||
        `باقة اشتراك لمدة ${numDays} يوم شاملة مرافق الجيم الأساسية.`,
      features: features.length > 0 ? features : ['دخول يومي لصالة الجيم'],
      freezeDaysAllowed: Number(freezeDaysAllowed) || 0,
      invitationsCount: Number(invitationsCount) || 0,
      active: true,
    });

    setName('');
    setDescription('');
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            خطط وباقات الاشتراك (Subscription Plans)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إنشاء وتخصيص باقات الجيم وتحديد السعر والمدة بالأيام وأيام التجميد المسموحة
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showCreateForm ? 'إغلاق نموذج الإضافة' : 'إنشاء خطة اشتراك جديدة'}</span>
        </button>
      </div>

      {/* Create Plan Form */}
      {showCreateForm && (
        <div className="rounded-xl bg-white border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            إضافة باقة اشتراك جديدة
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="plan-name-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  اسم الخطة / الباقة *
                </label>
                <input
                  id="plan-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: باقة شهرين — كمال أجسام ولياقة"
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="plan-duration-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  المدة بالأيام *
                </label>
                <input
                  id="plan-duration-input"
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="30"
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plan-price-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  السعر ({gymProfile.currency}) *
                </label>
                <input
                  id="plan-price-input"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="900"
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plan-category-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  التصنيف
                </label>
                <input
                  id="plan-category-input"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plan-freeze-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  أيام التجميد المسموحة (Freeze)
                </label>
                <input
                  id="plan-freeze-input"
                  type="number"
                  value={freezeDaysAllowed}
                  onChange={(e) => setFreezeDaysAllowed(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plan-invites-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  عدد دعوات الأصدقاء
                </label>
                <input
                  id="plan-invites-input"
                  type="number"
                  value={invitationsCount}
                  onChange={(e) => setInvitationsCount(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plan-desc-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  وصف مختصر
                </label>
                <input
                  id="plan-desc-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف سريع لمميزات الباقة"
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="plan-features-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                مميزات الخطة (سطر لكل ميزة)
              </label>
              <textarea
                id="plan-features-input"
                rows={3}
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-6 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white"
              >
                حفظ خطة الاشتراك
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const enrolledCount = members.filter((m) => m.subscription.planId === plan.id).length;
          const dailyCost = Math.round((plan.price / Math.max(1, plan.durationDays)) * 10) / 10;

          return (
            <div
              key={plan.id}
              className={`rounded-xl bg-white border p-5 flex flex-col justify-between transition-opacity ${
                plan.active ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-700">{plan.category}</span>
                  <span>{plan.active ? 'متاحة للتسجيل' : 'موقوفة مؤقتاً'}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-1">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{plan.description}</p>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                      {plan.price.toLocaleString('en-US')}
                    </span>
                    <span className="text-xs text-slate-500 mr-1">{gymProfile.currency}</span>
                  </div>
                  <div className="text-left text-xs text-slate-500 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      {plan.durationDays} يوم
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      ({dailyCost} {gymProfile.currency}/يوم)
                    </span>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-700">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    المشتركون بهذه الباقة:
                  </span>
                  <span className="font-mono font-bold text-slate-900">{enrolledCount} عضو</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onTogglePlanActive(plan.id)}
                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{plan.active ? 'إيقاف مؤقت' : 'تفعيل الباقة'}</span>
                  </button>

                  {enrolledCount === 0 && (
                    <button
                      type="button"
                      onClick={() => onDeletePlan(plan.id)}
                      aria-label={`حذف ${plan.name}`}
                      className="min-h-[38px] p-2 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
