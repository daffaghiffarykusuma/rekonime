const buildPrivacySafeMalExport = (catalog, { matched = 339, unmatched = 76 } = {}) => {
  const matchedIds = (Array.isArray(catalog) ? catalog : [])
    .map(item => Number(item?.malId))
    .filter((malId, index, values) => Number.isInteger(malId) && malId > 0 && values.indexOf(malId) === index)
    .slice(0, matched);
  if (matchedIds.length !== matched) throw new Error(`Fixture requires ${matched} catalog MAL IDs.`);
  const catalogIds = new Set(matchedIds);
  const unmatchedIds = [];
  for (let malId = 900000; unmatchedIds.length < unmatched; malId += 1) {
    if (!catalogIds.has(malId)) unmatchedIds.push(malId);
  }
  const rows = [
    ...matchedIds.map((malId, index) => ({ malId, title: `Matched title ${index + 1}` })),
    ...unmatchedIds.map((malId, index) => ({ malId, title: `Unmatched title ${index + 1}` }))
  ];
  const anime = rows.map(({ malId, title }) => `
    <anime>
      <series_animedb_id>${malId}</series_animedb_id>
      <series_title><![CDATA[${title}]]></series_title>
      <series_type>TV</series_type>
      <series_episodes>12</series_episodes>
      <my_id>0</my_id>
      <my_watched_episodes>0</my_watched_episodes>
      <my_start_date>0000-00-00</my_start_date>
      <my_finish_date>0000-00-00</my_finish_date>
      <my_rated></my_rated>
      <my_score>0</my_score>
      <my_storage></my_storage>
      <my_storage_value>0.00</my_storage_value>
      <my_status>Plan to Watch</my_status>
      <my_comments><![CDATA[]]></my_comments>
      <my_times_watched>0</my_times_watched>
      <my_rewatch_value></my_rewatch_value>
      <my_priority>LOW</my_priority>
      <my_tags><![CDATA[]]></my_tags>
      <my_rewatching>0</my_rewatching>
      <my_rewatching_ep>0</my_rewatching_ep>
      <my_discuss>1</my_discuss>
      <my_sns>default</my_sns>
      <update_on_import>0</update_on_import>
    </anime>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" ?>
<!-- Privacy-safe structural derivative of a MyAnimeList XML Export v1.1.0 file. -->
<myanimelist>
  <myinfo>
    <user_id>0</user_id>
    <user_name>fixture</user_name>
    <user_export_type>1</user_export_type>
    <user_total_anime>${rows.length}</user_total_anime>
    <user_total_watching>0</user_total_watching>
    <user_total_completed>0</user_total_completed>
    <user_total_onhold>0</user_total_onhold>
    <user_total_dropped>0</user_total_dropped>
    <user_total_plantowatch>${rows.length}</user_total_plantowatch>
  </myinfo>${anime}
</myanimelist>`;
};

export { buildPrivacySafeMalExport };
