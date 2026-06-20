// Adapters: turn a prompt's JSON output into flat rows for `assessments` + `grounding`.
// One adapter per model_key. Each returns { assessments:[...], grounding:[...] } where
// grounding rows reference their parent by `field_key` (the writer resolves the id after upsert).

function sixStreams(json, caseId) {
  const assessments = [];
  const grounding = [];
  for (const s of json.streams || []) {
    const insufficient = s.status === 'grounding_insufficient';
    const base = { case_id: caseId, model: 'six_streams', status: s.status || 'draft' };
    // three fields per stream: skill, level, grounding-statement
    assessments.push({ ...base, field_key: `ss_${s.stream}_skill`, value: s.new_skill || '', rating: null });
    assessments.push({ ...base, field_key: `ss_${s.stream}_level`, value: s.level || '', rating: s.level || null });
    assessments.push({ ...base, field_key: `ss_${s.stream}_grounding`, value: s.grounding || '', rating: null });
    // excerpts back the stream; attach them to the grounding-statement field
    if (!insufficient) {
      for (const g of s.grounding_excerpts || []) {
        grounding.push({ field_key: `ss_${s.stream}_grounding`, excerpt: g.quote, timestamp_ref: g.timestamp });
      }
    }
  }
  if (json.priority_streams) {
    assessments.push({ case_id: caseId, model: 'six_streams', field_key: 'ss_priority_streams',
                       value: json.priority_streams, rating: null, status: 'draft' });
  }
  return { assessments, grounding };
}

// Stubs for the remaining models — same shape, filled in as each prompt is authored.
function notImplemented(model) {
  return () => { throw new Error(`adapter for '${model}' not implemented yet`); };
}

function humanDomains(json, caseId) {
  const assessments = [];
  const grounding = [];
  for (const d of json.domains || []) {
    const fk = `analysis_hd_domain_${d.domain}`;
    assessments.push({ case_id: caseId, model: 'human_domains', field_key: fk,
                       value: d.content || '', rating: null, status: d.status || 'draft' });
    if (d.status !== 'grounding_insufficient') {
      for (const g of d.grounding_excerpts || []) {
        grounding.push({ field_key: fk, excerpt: g.quote, timestamp_ref: g.timestamp });
      }
    }
  }
  return { assessments, grounding };
}

function tenWays(json, caseId) {
  const assessments = [];
  const grounding = [];
  const insufficient = json.status === 'grounding_insufficient';
  const base = { case_id: caseId, model: 'ten_ways', status: json.status || 'draft' };
  assessments.push({ ...base, field_key: 'ten_ways_way_of_being', value: json.way_of_being || '', rating: null });
  assessments.push({ ...base, field_key: 'ten_ways_status', value: json.movement || '', rating: null });
  assessments.push({ ...base, field_key: 'ten_ways_grounding', value: json.grounding || '', rating: null });
  if (!insufficient) {
    for (const g of json.grounding_excerpts || []) {
      grounding.push({ field_key: 'ten_ways_grounding', excerpt: g.quote, timestamp_ref: g.timestamp });
    }
  }
  return { assessments, grounding };
}

function synthesis(json, caseId) {
  const a = [];
  const base = { case_id: caseId, model: 'synthesis', status: 'draft', rating: null };
  const push = (fk, v) => a.push({ ...base, field_key: fk, value: v || '' });
  push('new_understanding', json.new_understanding);
  push('coaching_topic', json.coaching_topic);
  push('purpose', json.purpose);
  const o = json.outcomes || [];
  push('outcome_1', o[0]); push('outcome_2', o[1]); push('outcome_3', o[2]);
  push('epq', json.epq);
  push('epq_grounding', json.epq_grounding);
  const c = json.current_narrative || {};
  push('narr_current_narrative', c.narrative);
  push('narr_current_who_am_i', c.who_am_i);
  push('narr_current_who_are_others', c.who_are_others);
  push('narr_current_what_is_mine', c.what_is_mine);
  push('narr_current_physical', c.physical);
  push('narr_current_epq_distorted', c.epq_distorted);
  const d = json.deeper_narrative || {};
  push('narr_deeper_narrative', d.narrative);
  push('narr_deeper_who_am_i', d.who_am_i);
  push('narr_deeper_who_are_others', d.who_are_others);
  push('narr_deeper_what_is_mine', d.what_is_mine);
  push('narr_deeper_physical', d.physical);
  push('narr_deeper_epq_expressed', d.epq_expressed);
  return { assessments: a, grounding: [] };
}

function programDesign(json, caseId) {
  const a = [];
  const base = { case_id: caseId, model: 'program_design', status: 'draft', rating: null };
  const push = (fk, v) => a.push({ ...base, field_key: fk, value: v || '' });
  const hd = json.human_domains || {};
  push('design_hd_domain_1', hd.domain_1);
  push('design_hd_domain_2', hd.domain_2);
  push('design_hd_domain_3', hd.domain_3);
  push('design_hd_domain_4', hd.domain_4);
  const sa = json.self_awareness || {};
  push('design_self_awareness_focus', sa.focus);
  push('design_self_awareness_reason', sa.reason);
  const pr = json.practices || {};
  push('design_practices_focus', pr.focus);
  push('design_practices_reason', pr.reason);
  const ex = json.exercises || {};
  push('design_exercises_focus', ex.focus);
  push('design_exercises_reason', ex.reason);
  return { assessments: a, grounding: [] };
}

module.exports = {
  six_streams: sixStreams,
  human_domains: humanDomains,
  ten_ways: tenWays,
  synthesis: synthesis,
  program_design: programDesign,
  impact: notImplemented('impact'),
};
