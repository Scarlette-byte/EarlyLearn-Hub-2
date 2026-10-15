import { barangays } from './supabaseClient';

// Baseline Daycare Centers across all 22 Barangays of Manolo Fortich
export const baselineCdcs = [
  { id: 'cdc-tankulan-1', name: 'Tankulan Central Child Development Center', barangay: 'Tankulan (Poblacion)', capacity: 30, enrolledCount: 26, attendanceRate: 94 },
  { id: 'cdc-tankulan-2', name: 'Poblacion Zone 2 Child Development Center', barangay: 'Tankulan (Poblacion)', capacity: 25, enrolledCount: 22, attendanceRate: 92 },
  { id: 'cdc-alae-1', name: 'Alae Proper Child Development Center', barangay: 'Alae', capacity: 28, enrolledCount: 25, attendanceRate: 93 },
  { id: 'cdc-alae-2', name: 'Batingtingan Child Development Center', barangay: 'Alae', capacity: 24, enrolledCount: 20, attendanceRate: 91 },
  { id: 'cdc-damilag-1', name: 'Centro Damilag Child Development Center', barangay: 'Damilag', capacity: 30, enrolledCount: 27, attendanceRate: 95 },
  { id: 'cdc-damilag-2', name: 'Menzi Daycare Center', barangay: 'Damilag', capacity: 25, enrolledCount: 24, attendanceRate: 94 },
  { id: 'cdc-dahilayan', name: 'Dahilayan Highland Child Development Center', barangay: 'Dahilayan', capacity: 22, enrolledCount: 19, attendanceRate: 93 },
  { id: 'cdc-dicklum', name: 'Dicklum Child Development Center', barangay: 'Dicklum', capacity: 25, enrolledCount: 21, attendanceRate: 90 },
  { id: 'cdc-agusan', name: 'Agusan Canyon Child Development Center', barangay: 'Agusan Canyon', capacity: 26, enrolledCount: 23, attendanceRate: 92 },
  { id: 'cdc-lunocan', name: 'Lunocan Central Child Development Center', barangay: 'Lunocan', capacity: 28, enrolledCount: 24, attendanceRate: 93 },
  { id: 'cdc-sanmiguel', name: 'San Miguel Child Development Center', barangay: 'San Miguel', capacity: 25, enrolledCount: 21, attendanceRate: 91 },
  { id: 'cdc-sankanan', name: 'Sankanan Child Development Center', barangay: 'Sankanan', capacity: 24, enrolledCount: 22, attendanceRate: 94 },
  { id: 'cdc-lingion', name: 'Lingion Child Development Center', barangay: 'Lingion', capacity: 25, enrolledCount: 20, attendanceRate: 89 },
  { id: 'cdc-kalugmanan', name: 'Kalugmanan Child Development Center', barangay: 'Kalugmanan', capacity: 24, enrolledCount: 19, attendanceRate: 91 },
  { id: 'cdc-maluko', name: 'Maluko Child Development Center', barangay: 'Maluko', capacity: 25, enrolledCount: 21, attendanceRate: 92 },
  { id: 'cdc-guilang', name: 'Guilang-guilang Child Development Center', barangay: 'Guilang-guilang', capacity: 22, enrolledCount: 18, attendanceRate: 90 },
  { id: 'cdc-dalirig', name: 'Dalirig Child Development Center', barangay: 'Dalirig', capacity: 26, enrolledCount: 22, attendanceRate: 93 },
  { id: 'cdc-lindaban', name: 'Lindaban Child Development Center', barangay: 'Lindaban', capacity: 22, enrolledCount: 17, attendanceRate: 88 },
  { id: 'cdc-mambatangan', name: 'Mambatangan Child Development Center', barangay: 'Mambatangan', capacity: 25, enrolledCount: 21, attendanceRate: 92 },
  { id: 'cdc-mampayag', name: 'Mampayag Child Development Center', barangay: 'Mampayag', capacity: 22, enrolledCount: 19, attendanceRate: 90 },
  { id: 'cdc-mantibugao', name: 'Mantibugao Child Development Center', barangay: 'Mantibugao', capacity: 24, enrolledCount: 20, attendanceRate: 91 },
  { id: 'cdc-minsuro', name: 'Minsuro Child Development Center', barangay: 'Minsuro', capacity: 20, enrolledCount: 16, attendanceRate: 89 },
  { id: 'cdc-santiago', name: 'Santiago Child Development Center', barangay: 'Santiago', capacity: 24, enrolledCount: 21, attendanceRate: 93 },
  { id: 'cdc-santonino', name: 'Santo Niño Child Development Center', barangay: 'Santo Niño', capacity: 24, enrolledCount: 20, attendanceRate: 91 },
  { id: 'cdc-ticala', name: 'Ticala Child Development Center', barangay: 'Ticala', capacity: 22, enrolledCount: 18, attendanceRate: 90 },
];

// Real Student Record for System Navigation & Operational Testing
// (Enrolled in Maluko Child Development Center under Teacher Lovey Guinevere Angeles Tion)
export const baselineLearners = [
  {
    id: 'lrn-real-001',
    full_name: 'Hannah Mae Tion',
    age: 3,
    birthdate: '2023-04-12',
    gender: 'Female',
    level: 'PRE-K 1',
    barangay: 'Maluko',
    cdc_id: 'cdc-maluko',
    cdc_name: 'Maluko Child Development Center',
    parent_name: 'Lovey Guinevere Tion',
    relationship: 'Mother',
    parent_contact: '0929-320-5411',
    address: 'Purok 1, Barangay Maluko, Manolo Fortich',
    enrollment_status: 'Enrolled',
  },
];

// Baseline Child Development Assessments (DepEd ECCD 4-Domain Evaluations for Ages 3-4)
export const baselineAssessments = [
  {
    id: 'ass-real-01',
    child_id: 'lrn-real-001',
    child_name: 'Hannah Mae Tion',
    age: 3,
    barangay: 'Maluko',
    cdc_name: 'Maluko Child Development Center',
    teacher_name: 'Teacher Lovey Guinevere Angeles Tion',
    date: 'Jun 24, 2026',
    cognitive_status: 'Developing as Expected',
    physical_status: 'Developing as Expected',
    social_status: 'Developing as Expected',
    language_status: 'Developing as Expected',
    overall_status: 'Developing as Expected',
    observations: 'Active in morning greeting routines. Identifies colors and counts 1 to 5 with counting blocks independently.',
    recommendation: 'Continue guided sensory play with mother tongue rhymes.',
    mswd_verified: true,
  },
];


// Baseline Program Implementation & Activity Reports from Daycare Workers
export const baselineActivityReports = [
  {
    id: 'rep-01',
    title: 'Q3 Supplementary Feeding & Healthy Fruit Discovery',
    cdc_name: 'Tankulan Central Child Development Center',
    teacher_name: 'Teacher Maricel Torres',
    barangay: 'Tankulan (Poblacion)',
    date: 'Oct 02, 2026',
    attendees_count: 24,
    summary: 'Conducted nutrition check and introduced local sweet pineapple and papaya slices to 3–4 year old learners. Weight and height recorded.',
    mswd_verified: true,
  },
  {
    id: 'rep-02',
    title: 'Parent-Teacher Early Childhood Care & Phonics Orientation',
    cdc_name: 'Centro Damilag Child Development Center',
    teacher_name: 'Teacher Annabelle Cruz',
    barangay: 'Damilag',
    date: 'Oct 04, 2026',
    attendees_count: 27,
    summary: 'Engaged 25 parents on the importance of 10-minute daily home rhymes and phone-guided activities for 3-year-olds.',
    mswd_verified: true,
  },
  {
    id: 'rep-03',
    title: 'Sensory Sand & Finger Painting Motor Workshop',
    cdc_name: 'Alae Proper Child Development Center',
    teacher_name: 'Teacher Maria Teresa Santos',
    barangay: 'Alae',
    date: 'Oct 06, 2026',
    attendees_count: 22,
    summary: 'Toddlers practiced drawing circles and tracing simple lines using natural non-toxic finger paints. 100% participation.',
    mswd_verified: false,
  },
  {
    id: 'rep-04',
    title: 'Global Handwashing Day Hygiene Demonstration',
    cdc_name: 'Dahilayan Highland Child Development Center',
    teacher_name: 'Teacher Joylyn Maghanoy',
    barangay: 'Dahilayan',
    date: 'Oct 07, 2026',
    attendees_count: 19,
    summary: 'Taught proper 20-second handwashing song with soap and water to daycare learners before morning snack time.',
    mswd_verified: true,
  },
  {
    id: 'rep-05',
    title: 'Quarterly ECCD 4-Domain Checklist Administration',
    cdc_name: 'Dicklum Child Development Center',
    teacher_name: 'Teacher Erlinda Pimentel',
    barangay: 'Dicklum',
    date: 'Oct 08, 2026',
    attendees_count: 21,
    summary: 'Evaluated cognitive, motor, socio-emotional, and language milestones for all registered 3-4 year old toddlers.',
    mswd_verified: false,
  },
];
