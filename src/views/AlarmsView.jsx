import { useApp } from '../store/AppContext';
import { METRICS, activeAlerts } from '../store/helpers';
import { Pills, Slider, Toggle } from '../components/UI';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

// The "Control" tab idea from the reference, repurposed: each card is a
// threshold rule you tune with a slider, an above/below toggle, and on/off.
export default function AlarmsView() {
  const { devices, alarmRules, updateAlarmRule, addAlarmRule, removeAlarmRule } = useApp();
  const alerts = activeAlerts(devices, alarmRules);

  return (
    <div>
      {alerts.length > 0 && (
        <div className="alertbanner">
          <AlertTriangle size={18} />
          {alerts.length} active alert{alerts.length > 1 ? 's' : ''} right now
        </div>
      )}

      {alerts.map((a, i) => {
        const m = METRICS[a.rule.metric];
        return (
          <div className="card tight" key={'al' + i} style={{ borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b>{a.device.name}</b>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>{a.value}{m.unit}</span>
            </div>
            <div className="muted">{m.label} is {a.rule.op} {a.rule.value}{m.unit}</div>
          </div>
        );
      })}

      <div className="section-title">Alarm rules</div>
      <div className="cardgrid">
      {alarmRules.map((rule) => {
        const m = METRICS[rule.metric];
        return (
          <div className="card" key={rule.id}>
            <div className="field__row">
              <div className="field__label">{m.label}</div>
              <Toggle checked={rule.enabled} onChange={(v) => updateAlarmRule(rule.id, { enabled: v })} />
            </div>
            <div style={{ margin: '4px 0 14px' }}>
              <Pills
                options={[{ value: 'below', label: 'Below' }, { value: 'above', label: 'Above' }]}
                value={rule.op}
                onChange={(v) => updateAlarmRule(rule.id, { op: v })}
                blue
              />
            </div>
            <div className="field__row">
              <span className="muted">Trigger threshold</span>
              <span className="field__value">{rule.value}{m.unit}</span>
            </div>
            <Slider min={m.min} max={m.max} value={rule.value} onChange={(v) => updateAlarmRule(rule.id, { value: v })} />
            <div className="ticks"><span>{m.min}{m.unit}</span><span>{m.max}{m.unit}</span></div>
            <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => removeAlarmRule(rule.id)}>
              <Trash2 size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Remove rule
            </button>
          </div>
        );
      })}
      </div>

      <button className="btn btn--green" onClick={() => addAlarmRule({ metric: 'soilMoisturePercent', op: 'below', value: 30 })}>
        <Plus size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Add alarm rule
      </button>
    </div>
  );
}
