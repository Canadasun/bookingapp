import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Switch,
  ActivityIndicator, SafeAreaView, Alert, Share, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, GRAY_100, GRAY_200, GRAY_400, GRAY_500, GRAY_700, GRAY_900 } from '../theme';
import { api } from '../api';
import { bizId } from '../auth';
import { WEB_URL } from '../config';

// ── Industry templates ────────────────────────────────────────────────────────

interface IndustryService { name: string; durationMinutes: number; priceCents: number }
interface IndustryTemplate {
  key: string; label: string; icon: string; emoji: string;
  services: IndustryService[];
  depositPercent: number;
  cancellationWindowHours: number;
  cancellationPolicy: string;
  availabilityDefaults: { dayOfWeek: number; startTime: string; endTime: string }[];
}

const TEMPLATES: IndustryTemplate[] = [
  {
    key: 'SALON', label: 'Hair Salon', icon: 'cut-outline', emoji: '💇',
    services: [
      { name: "Women's Haircut & Style", durationMinutes: 60, priceCents: 8500 },
      { name: "Men's Haircut", durationMinutes: 30, priceCents: 4500 },
      { name: "Colour & Highlights", durationMinutes: 150, priceCents: 22000 },
      { name: "Blowout", durationMinutes: 45, priceCents: 5500 },
    ],
    depositPercent: 30,
    cancellationWindowHours: 24,
    cancellationPolicy: 'We require 24 hours notice to cancel or reschedule. Late cancellations within 24 hours may be charged 50% of the service price.',
    availabilityDefaults: [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
  },
  {
    key: 'BARBER', label: 'Barbershop', icon: 'cut-outline', emoji: '💈',
    services: [
      { name: "Men's Haircut", durationMinutes: 30, priceCents: 4000 },
      { name: 'Beard Trim & Shape', durationMinutes: 20, priceCents: 2500 },
      { name: 'Hot Towel Shave', durationMinutes: 45, priceCents: 5500 },
      { name: "Kids' Cut (under 12)", durationMinutes: 20, priceCents: 3000 },
    ],
    depositPercent: 0,
    cancellationWindowHours: 12,
    cancellationPolicy: 'Please provide 12 hours notice for cancellations. No-shows may be charged a $20 fee.',
    availabilityDefaults: [1,2,3,4,5,6].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
  },
  {
    key: 'LASH', label: 'Lash Tech', icon: 'eye-outline', emoji: '👁️',
    services: [
      { name: 'Classic Full Set', durationMinutes: 120, priceCents: 15000 },
      { name: 'Hybrid Full Set', durationMinutes: 150, priceCents: 18000 },
      { name: 'Volume Full Set', durationMinutes: 180, priceCents: 22000 },
      { name: '2-Week Fill', durationMinutes: 60, priceCents: 7500 },
    ],
    depositPercent: 50,
    cancellationWindowHours: 48,
    cancellationPolicy: 'Lash appointments require 48 hours notice to cancel or reschedule. A 50% deposit is required to book. Cancellations within 48 hours forfeit the deposit.',
    availabilityDefaults: [2,3,4,5,6].map(d => ({ dayOfWeek: d, startTime: '10:00', endTime: '18:00' })),
  },
  {
    key: 'ESTHETICS', label: 'Esthetician', icon: 'sparkles-outline', emoji: '✨',
    services: [
      { name: 'Classic Facial', durationMinutes: 60, priceCents: 9500 },
      { name: 'Deep Pore Cleanse', durationMinutes: 75, priceCents: 11000 },
      { name: 'Brow Shape & Tint', durationMinutes: 45, priceCents: 5500 },
      { name: 'Full Face Wax', durationMinutes: 30, priceCents: 4500 },
    ],
    depositPercent: 25,
    cancellationWindowHours: 24,
    cancellationPolicy: 'We require 24 hours notice for cancellations. A deposit may be collected for new clients.',
    availabilityDefaults: [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '10:00', endTime: '17:00' })),
  },
  {
    key: 'NAILS', label: 'Nail Tech', icon: 'color-palette-outline', emoji: '💅',
    services: [
      { name: 'Classic Manicure', durationMinutes: 45, priceCents: 4500 },
      { name: 'Gel Manicure', durationMinutes: 60, priceCents: 6500 },
      { name: 'Classic Pedicure', durationMinutes: 60, priceCents: 6000 },
      { name: 'Nail Art (per nail)', durationMinutes: 15, priceCents: 1000 },
    ],
    depositPercent: 0,
    cancellationWindowHours: 24,
    cancellationPolicy: 'Please give 24 hours notice for cancellations. Repeated no-shows may require a deposit for future bookings.',
    availabilityDefaults: [2,3,4,5,6].map(d => ({ dayOfWeek: d, startTime: '10:00', endTime: '18:00' })),
  },
  {
    key: 'MASSAGE', label: 'Massage Therapy', icon: 'hand-left-outline', emoji: '💆',
    services: [
      { name: 'Swedish Relaxation (60 min)', durationMinutes: 60, priceCents: 10000 },
      { name: 'Deep Tissue (60 min)', durationMinutes: 60, priceCents: 11000 },
      { name: 'Hot Stone Massage (90 min)', durationMinutes: 90, priceCents: 14000 },
      { name: 'Sports Massage (45 min)', durationMinutes: 45, priceCents: 8500 },
    ],
    depositPercent: 25,
    cancellationWindowHours: 24,
    cancellationPolicy: 'Please provide 24 hours notice for cancellations or rescheduling. Late cancellations may incur a 50% service fee.',
    availabilityDefaults: [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00' })),
  },
  {
    key: 'GROOMING', label: 'Pet Groomer', icon: 'paw-outline', emoji: '🐾',
    services: [
      { name: 'Bath & Blow-dry', durationMinutes: 60, priceCents: 6500 },
      { name: 'Full Groom (bath, cut, nails)', durationMinutes: 120, priceCents: 9500 },
      { name: 'Nail Trim', durationMinutes: 15, priceCents: 2000 },
      { name: 'De-shedding Treatment', durationMinutes: 90, priceCents: 8500 },
    ],
    depositPercent: 25,
    cancellationWindowHours: 24,
    cancellationPolicy: "We require 24 hours notice to cancel or reschedule your pet's appointment. No-shows may be charged $25.",
    availabilityDefaults: [1,2,3,4,5,6].map(d => ({ dayOfWeek: d, startTime: '08:00', endTime: '16:00' })),
  },
  {
    key: 'TATTOO', label: 'Tattoo Artist', icon: 'brush-outline', emoji: '🖊️',
    services: [
      { name: 'Consultation (free)', durationMinutes: 30, priceCents: 0 },
      { name: 'Small Tattoo (under 2")', durationMinutes: 60, priceCents: 15000 },
      { name: 'Medium Tattoo (2"–4")', durationMinutes: 180, priceCents: 40000 },
      { name: 'Touch-up', durationMinutes: 60, priceCents: 8000 },
    ],
    depositPercent: 50,
    cancellationWindowHours: 72,
    cancellationPolicy: 'All tattoo appointments require a 50% non-refundable deposit. Cancellations within 72 hours forfeit the deposit. Rescheduling with 72+ hours notice keeps your deposit.',
    availabilityDefaults: [2,3,4,5,6].map(d => ({ dayOfWeek: d, startTime: '11:00', endTime: '19:00' })),
  },
  {
    key: 'WELLNESS', label: 'Wellness Provider', icon: 'heart-outline', emoji: '🌿',
    services: [
      { name: 'Reiki Session (60 min)', durationMinutes: 60, priceCents: 9000 },
      { name: 'Sound Bath', durationMinutes: 75, priceCents: 8500 },
      { name: 'Initial Consultation', durationMinutes: 60, priceCents: 10000 },
      { name: 'Follow-up Session', durationMinutes: 45, priceCents: 7500 },
    ],
    depositPercent: 25,
    cancellationWindowHours: 24,
    cancellationPolicy: 'Please provide 24 hours notice for cancellations. A 25% deposit may be collected for new clients.',
    availabilityDefaults: [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00' })),
  },
  {
    key: 'CONSULTANT', label: 'Consultant', icon: 'briefcase-outline', emoji: '💼',
    services: [
      { name: 'Discovery Call (30 min)', durationMinutes: 30, priceCents: 0 },
      { name: 'Strategy Session (60 min)', durationMinutes: 60, priceCents: 20000 },
      { name: 'Implementation Session (2h)', durationMinutes: 120, priceCents: 40000 },
      { name: 'Monthly Retainer Check-in', durationMinutes: 45, priceCents: 0 },
    ],
    depositPercent: 50,
    cancellationWindowHours: 48,
    cancellationPolicy: 'All consulting sessions require 50% payment upfront. Cancellations within 48 hours are non-refundable. Rescheduling with 48+ hours notice is always available.',
    availabilityDefaults: [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00' })),
  },
];

// ── Main component ────────────────────────────────────────────────────────────

interface Props { onComplete: () => void }

type Step = 'industry' | 'services' | 'availability' | 'cancellation' | 'deposit' | 'launch';

export function OnboardingScreen({ onComplete }: Props) {
  const bid = bizId();
  const [step, setStep] = useState<Step>('industry');
  const [template, setTemplate] = useState<IndustryTemplate | null>(null);
  const [services, setServices] = useState<(IndustryService & { selected: boolean })[]>([]);
  const [availability, setAvailability] = useState<{ dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }[]>(
    [0, 1, 2, 3, 4, 5, 6].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00', enabled: d >= 1 && d <= 5 }))
  );
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositPercent, setDepositPercent] = useState('30');
  const [saving, setSaving] = useState(false);
  const [bizSlug, setBizSlug] = useState('');

  const STEPS: Step[] = ['industry', 'services', 'availability', 'cancellation', 'deposit', 'launch'];
  const stepIndex = STEPS.indexOf(step);

  function selectIndustry(t: IndustryTemplate) {
    setTemplate(t);
    setServices(t.services.map(s => ({ ...s, selected: true })));
    setCancellationPolicy(t.cancellationPolicy);
    setRequireDeposit(t.depositPercent > 0);
    setDepositPercent(String(t.depositPercent || 30));
    const avail = [0, 1, 2, 3, 4, 5, 6].map(d => {
      const rule = t.availabilityDefaults.find(r => r.dayOfWeek === d);
      return { dayOfWeek: d, startTime: rule?.startTime ?? '09:00', endTime: rule?.endTime ?? '17:00', enabled: !!rule };
    });
    setAvailability(avail);
    setStep('services');
  }

  async function finish() {
    setSaving(true);
    try {
      const selectedServices = services.filter(s => s.selected);
      // Save services
      for (const svc of selectedServices) {
        await api(`/businesses/${bid}/services`, {
          method: 'POST',
          body: JSON.stringify({ name: svc.name, durationMinutes: svc.durationMinutes, priceCents: svc.priceCents, active: true, capacity: 1 }),
        }).catch(() => {});
      }
      // Save hours
      const hours = availability.filter(a => a.enabled);
      if (hours.length) {
        await api(`/businesses/${bid}/hours`, {
          method: 'POST',
          body: JSON.stringify({ hours }),
        }).catch(() => {});
      }
      // Save business settings
      await api(`/businesses/${bid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          cancellationPolicy: cancellationPolicy.trim() || undefined,
          requireDeposit,
          depositPercent: requireDeposit ? Number.parseInt(depositPercent, 10) || 30 : 0,
        }),
      }).catch(() => {});
      // Get slug for sharing
      const biz = await api<any>(`/businesses/${bid}`).catch(() => null);
      if (biz?.slug) setBizSlug(biz.slug);
      setStep('launch');
    } catch (e) {
      Alert.alert('Error', 'Could not save some settings — you can update them in the Dashboard.');
      setStep('launch');
    } finally {
      setSaving(false);
    }
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ── Render ──

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Progress bar */}
      {step !== 'launch' && (
        <View style={{ height: 3, backgroundColor: GRAY_100, marginTop: 4 }}>
          <View style={{ height: 3, backgroundColor: BRAND, width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </View>
      )}

      {/* ── Step 1: Industry ── */}
      {step === 'industry' && (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: GRAY_900, marginBottom: 6 }}>
            What kind of business do you run?
          </Text>
          <Text style={{ fontSize: 15, color: GRAY_500, marginBottom: 24 }}>
            We'll set up your services, pricing, and policies automatically.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {TEMPLATES.map(t => (
              <TouchableOpacity
                key={t.key}
                onPress={() => selectIndustry(t)}
                style={{
                  width: '47%', backgroundColor: '#F8F7FF', borderRadius: 16,
                  padding: 16, borderWidth: 2, borderColor: GRAY_100,
                  alignItems: 'flex-start', gap: 8,
                }}
                accessibilityRole="button"
                accessibilityLabel={t.label}
              >
                <Text style={{ fontSize: 28 }}>{t.emoji}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: GRAY_900 }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={onComplete}
            style={{ marginTop: 24, alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={{ fontSize: 14, color: GRAY_400, fontWeight: '500' }}>Skip setup →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Step 2: Services ── */}
      {step === 'services' && (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 28 }}>
          <StepHeader step={stepIndex + 1} total={STEPS.length - 1} title="Your services" sub="Tap to include or remove. You can add more later." />
          {services.map((svc, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setServices(prev => prev.map((s, j) => j === i ? { ...s, selected: !s.selected } : s))}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8,
                borderWidth: 2, borderColor: svc.selected ? BRAND : GRAY_100,
                backgroundColor: svc.selected ? '#F5F3FF' : '#FAFAFA',
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: svc.selected }}
              accessibilityLabel={svc.name}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: GRAY_900 }}>{svc.name}</Text>
                <Text style={{ fontSize: 13, color: GRAY_500, marginTop: 2 }}>
                  {svc.durationMinutes} min · {svc.priceCents ? `$${(svc.priceCents / 100).toFixed(0)}` : 'Free'}
                </Text>
              </View>
              <Ionicons name={svc.selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={svc.selected ? BRAND : GRAY_300} />
            </TouchableOpacity>
          ))}
          <NavButtons onBack={() => setStep('industry')} onNext={() => setStep('availability')} />
        </ScrollView>
      )}

      {/* ── Step 3: Availability ── */}
      {step === 'availability' && (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 28 }}>
          <StepHeader step={stepIndex + 1} total={STEPS.length - 1} title="When are you open?" sub="Set your regular weekly hours." />
          {availability.map((day, i) => (
            <View key={day.dayOfWeek} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#FAFAFA', borderRadius: 14, borderWidth: 1, borderColor: GRAY_100 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: day.enabled ? GRAY_900 : GRAY_400, width: 40 }}>
                  {DAYS[day.dayOfWeek]}
                </Text>
                {day.enabled ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginHorizontal: 10 }}>
                    <TextInput
                      style={{ flex: 1, borderWidth: 1, borderColor: GRAY_200, borderRadius: 8, padding: 8, fontSize: 14, color: GRAY_900, textAlign: 'center', backgroundColor: '#fff' }}
                      value={day.startTime}
                      onChangeText={v => setAvailability(prev => prev.map((a, j) => j === i ? { ...a, startTime: v } : a))}
                      placeholder="09:00"
                    />
                    <Text style={{ color: GRAY_400 }}>–</Text>
                    <TextInput
                      style={{ flex: 1, borderWidth: 1, borderColor: GRAY_200, borderRadius: 8, padding: 8, fontSize: 14, color: GRAY_900, textAlign: 'center', backgroundColor: '#fff' }}
                      value={day.endTime}
                      onChangeText={v => setAvailability(prev => prev.map((a, j) => j === i ? { ...a, endTime: v } : a))}
                      placeholder="17:00"
                    />
                  </View>
                ) : (
                  <Text style={{ flex: 1, marginHorizontal: 10, fontSize: 13, color: GRAY_400 }}>Closed</Text>
                )}
                <Switch
                  value={day.enabled}
                  onValueChange={v => setAvailability(prev => prev.map((a, j) => j === i ? { ...a, enabled: v } : a))}
                  trackColor={{ true: BRAND, false: GRAY_200 }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          ))}
          <NavButtons onBack={() => setStep('services')} onNext={() => setStep('cancellation')} />
        </ScrollView>
      )}

      {/* ── Step 4: Cancellation policy ── */}
      {step === 'cancellation' && (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 28 }}>
          <StepHeader step={stepIndex + 1} total={STEPS.length - 1} title="Cancellation policy" sub="We've written one for your industry. Edit it or keep it as-is." />
          <TextInput
            style={{
              borderWidth: 1, borderColor: GRAY_200, borderRadius: 14, padding: 14,
              fontSize: 15, color: GRAY_900, minHeight: 140, textAlignVertical: 'top',
              lineHeight: 22,
            }}
            multiline
            value={cancellationPolicy}
            onChangeText={setCancellationPolicy}
            placeholder="Enter your cancellation policy..."
            placeholderTextColor={GRAY_400}
          />
          <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 8 }}>
            This appears on your booking page and in confirmation emails.
          </Text>
          <NavButtons onBack={() => setStep('availability')} onNext={() => setStep('deposit')} />
        </ScrollView>
      )}

      {/* ── Step 5: Deposit ── */}
      {step === 'deposit' && (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 28 }}>
          <StepHeader step={stepIndex + 1} total={STEPS.length - 1} title="Require a deposit?" sub="Deposits protect your revenue from no-shows. You can change this later." />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {([false, true] as const).map(v => (
              <TouchableOpacity
                key={String(v)}
                onPress={() => setRequireDeposit(v)}
                style={{
                  flex: 1, padding: 18, borderRadius: 16, borderWidth: 2, alignItems: 'center',
                  borderColor: requireDeposit === v ? BRAND : GRAY_100,
                  backgroundColor: requireDeposit === v ? '#F5F3FF' : '#FAFAFA',
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: requireDeposit === v }}
                accessibilityLabel={v ? 'Yes, require deposit' : 'No deposit'}
              >
                <Ionicons name={v ? 'shield-checkmark' : 'close-circle-outline'} size={28} color={requireDeposit === v ? BRAND : GRAY_400} style={{ marginBottom: 8 }} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: requireDeposit === v ? BRAND : GRAY_700 }}>{v ? 'Yes, require it' : 'No deposit'}</Text>
                <Text style={{ fontSize: 12, color: GRAY_500, textAlign: 'center', marginTop: 4 }}>
                  {v ? 'Protect your time from no-shows' : 'Clients book without paying upfront'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {requireDeposit && (
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: GRAY_700, marginBottom: 8 }}>Deposit percentage</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['20', '25', '30', '50', '100'].map(pct => (
                  <TouchableOpacity
                    key={pct}
                    onPress={() => setDepositPercent(pct)}
                    style={{
                      flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 2,
                      borderColor: depositPercent === pct ? BRAND : GRAY_100,
                      backgroundColor: depositPercent === pct ? '#F5F3FF' : '#FAFAFA',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${pct}% deposit`}
                    accessibilityState={{ selected: depositPercent === pct }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: depositPercent === pct ? BRAND : GRAY_700 }}>{pct}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 10 }}>
                {pctLabel(depositPercent)} of each service price is collected at booking.
              </Text>
            </View>
          )}
          <NavButtons
            onBack={() => setStep('cancellation')}
            onNext={finish}
            nextLabel={saving ? 'Setting up…' : 'Finish setup'}
            nextDisabled={saving}
            loading={saving}
          />
        </ScrollView>
      )}

      {/* ── Step 6: Launch ── */}
      {step === 'launch' && (
        <ScrollView contentContainerStyle={{ flex: 1, padding: 24, paddingTop: 48, alignItems: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={48} color="#059669" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: GRAY_900, textAlign: 'center', marginBottom: 8 }}>
            You're ready to go!
          </Text>
          <Text style={{ fontSize: 16, color: GRAY_500, textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
            Your booking page is live. Share it with clients to start taking appointments.
          </Text>
          {bizSlug ? (
            <TouchableOpacity
              onPress={async () => {
                const url = `${WEB_URL}/book/${bizSlug}`;
                await Share.share({ message: `Book with me at Pulse Appointments:\n${url}`, url });
              }}
              style={{ backgroundColor: BRAND, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, width: '100%', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel="Share your booking link"
            >
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Share your booking link</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={onComplete}
            style={{ borderWidth: 2, borderColor: GRAY_200, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Open dashboard"
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: GRAY_700 }}>Open dashboard</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: GRAY_400, marginTop: 20, textAlign: 'center' }}>
            By using Pulse Appointments you agree to our{' '}
            <Text style={{ color: BRAND }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: BRAND }}>Privacy Policy</Text>
            {' '}(PIPEDA compliant).
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── helper components ─────────────────────────────────────────────────────────

function StepHeader({ step, total, title, sub }: { step: number; total: number; title: string; sub: string }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Step {step} of {total}
      </Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: GRAY_900, marginBottom: 4 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: GRAY_500 }}>{sub}</Text>
    </View>
  );
}

function NavButtons({ onBack, onNext, nextLabel = 'Continue', nextDisabled = false, loading = false }: {
  onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; loading?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 28 }}>
      <TouchableOpacity
        onPress={onBack}
        style={{ flex: 1, borderWidth: 2, borderColor: GRAY_200, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: GRAY_700 }}>Back</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onNext}
        disabled={nextDisabled}
        style={{ flex: 2, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: nextDisabled ? 0.6 : 1 }}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{nextLabel}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

function pctLabel(pct: string): string {
  switch (pct) {
    case '100': return 'Full payment (100%)';
    case '50': return 'Half (50%)';
    case '30': return 'A third (30%)';
    case '25': return 'A quarter (25%)';
    default: return `${pct}%`;
  }
}

const GRAY_300 = '#D1D5DB';
