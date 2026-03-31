type DateTimeFieldsProps = {
  dateLabel?: string;
  timeLabel?: string;
  dateValue: string;
  timeValue: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

export default function DateTimeFields({
  dateLabel = "Date",
  timeLabel = "Heure",
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
}: DateTimeFieldsProps) {
  return (
    <div className="grid-two">
      <label className="field-block">
        <span>{dateLabel}</span>
        <input
          className="field-input"
          type="date"
          lang="fr-FR"
          value={dateValue}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>

      <label className="field-block">
        <span>{timeLabel}</span>
        <input
          className="field-input"
          type="time"
          lang="fr-FR"
          step={300}
          value={timeValue}
          onChange={(event) => onTimeChange(event.target.value)}
        />
      </label>
    </div>
  );
}
