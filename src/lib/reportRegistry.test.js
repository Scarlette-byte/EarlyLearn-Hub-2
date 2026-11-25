import { describe, it, expect } from 'vitest';
import { REPORT_REGISTRY } from './reportRegistry.js';

describe('REPORT_REGISTRY', () => {
  it('includes all 6 required reports', () => {
    const ids = REPORT_REGISTRY.map((r) => r.id);
    expect(ids).toEqual([
      'class_enrollment',
      'activity',
      'teachers_list',
      'student_progress',
      'student_development',
      'eccd_form_1_1',
    ]);
  });

  it('scopes teachers_list to admin and superadmin', () => {
    const rep = REPORT_REGISTRY.find((r) => r.id === 'teachers_list');
    expect(rep.allowedRoles).toEqual(['superadmin', 'admin']);
  });

  it('builds ECCD Form 1.1 rows with domain scaled and standard scores', () => {
    const rep = REPORT_REGISTRY.find((r) => r.id === 'eccd_form_1_1');
    const rows = rep.buildRows(
      {
        assessments: [
          {
            cdc_name: 'Dalirig CDC',
            barangay: 'Dalirig',
            gross_motor: 10,
            fine_motor: 12,
            self_help: 11,
            receptive_language: 10,
            expressive_language: 9,
            cognitive: 11,
            social_emotional: 12,
            standard_score: 105,
            improvement_delta: 8,
          },
        ],
      },
      {}
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].cdc_name).toBe('Dalirig CDC');
    expect(rows[0].avg_standard_score).toBe('105.0');
    expect(rows[0].improvement_3_6_mo).toBe('+8.0 pts');
  });
});
