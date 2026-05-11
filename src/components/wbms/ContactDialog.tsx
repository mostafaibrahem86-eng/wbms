'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ContactItem } from '@/lib/store';
import { apiFetch } from '@/lib/apiFetch';
import { normalizePhone, getPhoneError } from '@/lib/phone';

/* ─── Country Codes ─── */

interface CountryDef {
  code: string;
  label: string;
  flag: string;
  placeholder: string;
  capital: string;
}

const COUNTRIES: CountryDef[] = [
  { code: '20', label: 'Egypt (+20)', flag: '🇪🇬', placeholder: '01012345678', capital: 'Cairo' },
  { code: '966', label: 'Saudi Arabia (+966)', flag: '🇸🇦', placeholder: '551234567', capital: 'Riyadh' },
  { code: '971', label: 'UAE (+971)', flag: '🇦🇪', placeholder: '501234567', capital: 'Abu Dhabi' },
  { code: '965', label: 'Kuwait (+965)', flag: '🇰🇼', placeholder: '12345678', capital: 'Kuwait City' },
  { code: '974', label: 'Qatar (+974)', flag: '🇶🇦', placeholder: '12345678', capital: 'Doha' },
  { code: '968', label: 'Oman (+968)', flag: '🇴🇲', placeholder: '91234567', capital: 'Muscat' },
  { code: '973', label: 'Bahrain (+973)', flag: '🇧🇭', placeholder: '12345678', capital: 'Manama' },
  { code: '962', label: 'Jordan (+962)', flag: '🇯🇴', placeholder: '712345678', capital: 'Amman' },
  { code: '961', label: 'Lebanon (+961)', flag: '🇱🇧', placeholder: '71234567', capital: 'Beirut' },
  { code: '964', label: 'Iraq (+964)', flag: '🇮🇶', placeholder: '7123456789', capital: 'Baghdad' },
  { code: '212', label: 'Morocco (+212)', flag: '🇲🇦', placeholder: '612345678', capital: 'Rabat' },
  { code: '216', label: 'Tunisia (+216)', flag: '🇹🇳', placeholder: '20123456', capital: 'Tunis' },
  { code: '213', label: 'Algeria (+213)', flag: '🇩🇿', placeholder: '551234567', capital: 'Algiers' },
  { code: '218', label: 'Libya (+218)', flag: '🇱🇾', placeholder: '912345678', capital: 'Tripoli' },
  { code: '249', label: 'Sudan (+249)', flag: '🇸🇩', placeholder: '912345678', capital: 'Khartoum' },
  { code: '963', label: 'Syria (+963)', flag: '🇸🇾', placeholder: '912345678', capital: 'Damascus' },
  { code: '970', label: 'Palestine (+970)', flag: '🇵🇸', placeholder: '591234567', capital: 'Jerusalem' },
  { code: '967', label: 'Yemen (+967)', flag: '🇾🇪', placeholder: '712345678', capital: 'Sana\'a' },
  { code: '1', label: 'USA/Canada (+1)', flag: '🇺🇸', placeholder: '4155552671', capital: 'New York' },
  { code: '44', label: 'UK (+44)', flag: '🇬🇧', placeholder: '7911123456', capital: 'London' },
  { code: '49', label: 'Germany (+49)', flag: '🇩🇪', placeholder: '15112345678', capital: 'Berlin' },
  { code: '33', label: 'France (+33)', flag: '🇫🇷', placeholder: '612345678', capital: 'Paris' },
  { code: '91', label: 'India (+91)', flag: '🇮🇳', placeholder: '9876543210', capital: 'New Delhi' },
  { code: '90', label: 'Turkey (+90)', flag: '🇹🇷', placeholder: '5321234567', capital: 'Istanbul' },
  { code: '55', label: 'Brazil (+55)', flag: '🇧🇷', placeholder: '11987654321', capital: 'São Paulo' },
  { code: '86', label: 'China (+86)', flag: '🇨🇳', placeholder: '13123456789', capital: 'Beijing' },
  { code: '81', label: 'Japan (+81)', flag: '🇯🇵', placeholder: '9012345678', capital: 'Tokyo' },
  { code: '234', label: 'Nigeria (+234)', flag: '🇳🇬', placeholder: '8012345678', capital: 'Lagos' },
  { code: '27', label: 'South Africa (+27)', flag: '🇿🇦', placeholder: '821234567', capital: 'Johannesburg' },
];

function findCountryByCode(code: string): CountryDef | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

function detectCountryCode(phone: string): { countryCode: string; localNumber: string } {
  if (!phone) return { countryCode: '20', localNumber: '' };

  const digits = phone.replace(/[^0-9]/g, '');

  // Try to match known country codes (longest first)
  const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);

  for (const country of sortedCountries) {
    if (digits.startsWith(country.code)) {
      return {
        countryCode: country.code,
        localNumber: digits.slice(country.code.length),
      };
    }
  }

  // Fallback: treat as local number with default code
  return { countryCode: '20', localNumber: digits };
}

/* ─── Component ─── */

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactItem | null;
  onSave: () => void;
}

export default function ContactDialog({ open, onOpenChange, contact, onSave }: ContactDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!contact;

  // Split phone into country code + local number
  const { countryCode: initCountryCode, localNumber: initLocalNumber } = useMemo(
    () => detectCountryCode(contact?.phone || ''),
    [contact]
  );

  const [countryCode, setCountryCode] = useState(initCountryCode);
  const [localNumber, setLocalNumber] = useState(initLocalNumber);
  const [name, setName] = useState(contact?.name || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [city, setCity] = useState(contact?.city || '');
  const [tags, setTags] = useState(contact?.tags || '');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [source, setSource] = useState(contact?.source || 'manual');
  const [contactStatus, setContactStatus] = useState(contact?.status || 'active');
  const [isBlocked, setIsBlocked] = useState(contact?.isBlocked || false);

  const selectedCountry = findCountryByCode(countryCode);

  // Auto-fill city when country code changes (only if city was empty or auto-filled before)
  useEffect(() => {
    if (open) {
      if (isEdit) {
        // Edit mode: don't override existing city
      } else {
        // Add mode: auto-fill capital if city is empty
        if (!city || city === initLocalNumber) {
          const country = findCountryByCode(countryCode);
          if (country) {
            setCity(country.capital);
          }
        }
      }
    }
  }, [countryCode]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (contact) {
        const { countryCode: cc, localNumber: ln } = detectCountryCode(contact.phone);
        setCountryCode(cc);
        setLocalNumber(ln);
        setName(contact.name);
        setEmail(contact.email || '');
        setCity(contact.city || '');
        setTags(contact.tags || '');
        setNotes(contact.notes || '');
        setSource(contact.source || 'manual');
        setContactStatus(contact.status || 'active');
        setIsBlocked(contact.isBlocked || false);
      } else {
        setCountryCode('20');
        setLocalNumber('');
        setName('');
        setEmail('');
        setCity('Cairo');
        setTags('');
        setNotes('');
        setSource('manual');
        setContactStatus('active');
        setIsBlocked(false);
      }
    }
  }, [open, contact]);

  const fullPhone = localNumber ? `${countryCode}${localNumber}` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !fullPhone) {
      toast({ title: 'Error', description: 'Name and phone are required', variant: 'destructive' });
      return;
    }
    const phoneError = getPhoneError(fullPhone);
    if (phoneError) {
      toast({ title: 'رقم غير صالح', description: phoneError, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        phone: normalizePhone(fullPhone),
        email: email.trim() || null,
        city: city.trim() || null,
        tags: tags.trim(),
        notes: notes.trim(),
        source,
        status: contactStatus,
        isBlocked,
        ...(isEdit && contact?.phone !== normalizePhone(fullPhone) && { newPhone: normalizePhone(fullPhone) }),
      };

      const url = isEdit ? `/api/contacts/${encodeURIComponent(contact!.phone)}` : '/api/contacts';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save contact');
      toast({ title: 'Done', description: isEdit ? 'Contact updated successfully' : 'Contact added successfully' });
      onOpenChange(false);
      onSave();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
            />
          </div>

          {/* Phone with Country Code */}
          <div className="space-y-2">
            <Label>Phone *</Label>
            <div className="flex gap-2">
              <Select value={countryCode} onValueChange={(v) => setCountryCode(v)}>
                <SelectTrigger className="w-[160px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-1.5">
                        <span>{c.flag}</span>
                        <span>+{c.code}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={localNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setLocalNumber(val);
                }}
                placeholder={selectedCountry?.placeholder || 'Phone number'}
                className="flex-1 font-mono"
                dir="ltr"
              />
            </div>
            {localNumber && (
              <p className="text-[11px] text-gray-400 font-mono" dir="ltr">
                Full: +{fullPhone}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              dir="ltr"
            />
          </div>

          {/* City + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-city">City</Label>
              <Input
                id="contact-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={selectedCountry?.capital || 'City'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-source">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={contactStatus} onValueChange={(v) => setContactStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="contact-tags">Tags (comma separated)</Label>
            <Input
              id="contact-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="customer, VIP, new"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>

          {/* Block/Unblock (Edit mode only) */}
          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-700">Block Contact</p>
                <p className="text-xs text-gray-400">Blocked contacts won&apos;t receive messages</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBlocked(!isBlocked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isBlocked ? 'bg-red-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isBlocked ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-whatsapp hover:bg-whatsapp-dark text-white" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
