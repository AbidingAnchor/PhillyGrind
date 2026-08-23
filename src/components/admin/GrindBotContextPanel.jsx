export default function GrindBotContextPanel({ policyContext }) {
  const context = policyContext || { title: 'General moderation', bullets: [] };

  return (
    <section className="admin-case-panel admin-case-policy">
      <h2>GrindBot policy context</h2>
      <p className="admin-case-policy-note">Static policy excerpts — no AI summary in this pass.</p>
      <h3>{context.title}</h3>
      <ul className="admin-case-policy-list">
        {(context.bullets || []).map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}
