export function parseNamingRule(template: string): string {
  let result = template;
  const now = new Date();

  // Environment variables mock
  result = result.replace(/%os%/g, 'macOS');
  result = result.replace(/%computername%/g, 'My-MacBook-Pro');
  result = result.replace(/%username%/g, 'neo');
  result = result.replace(/%title%/g, 'OpenFlow Studio');
  result = result.replace(/%title:50%/g, 'OpenFlow Studio'.substring(0, 50));

  // Date and Time variables enclosed in $...$
  result = result.replace(/\$(.*?)\$/g, (match, p1) => {
    let dateStr = p1;

    // Replace year
    dateStr = dateStr.replace(/yyyy/g, now.getFullYear().toString());
    dateStr = dateStr.replace(/yy/g, now.getFullYear().toString().slice(-2));

    // Replace month
    const month = now.getMonth() + 1;
    dateStr = dateStr.replace(/MMMM/g, now.toLocaleString('en-US', { month: 'long' }));
    dateStr = dateStr.replace(/MMM/g, now.toLocaleString('en-US', { month: 'short' }));
    dateStr = dateStr.replace(/MM/g, month.toString().padStart(2, '0'));
    dateStr = dateStr.replace(/M/g, month.toString());

    // Replace day
    const day = now.getDate();
    dateStr = dateStr.replace(/dddd/g, now.toLocaleString('en-US', { weekday: 'long' }));
    dateStr = dateStr.replace(/ddd/g, now.toLocaleString('en-US', { weekday: 'short' }));
    dateStr = dateStr.replace(/dd/g, day.toString().padStart(2, '0'));
    dateStr = dateStr.replace(/d/g, day.toString());

    // Replace hours
    const hours = now.getHours();
    dateStr = dateStr.replace(/HH/g, hours.toString().padStart(2, '0'));
    dateStr = dateStr.replace(/H/g, hours.toString());

    // Replace minutes
    const minutes = now.getMinutes();
    dateStr = dateStr.replace(/mm/g, minutes.toString().padStart(2, '0'));
    dateStr = dateStr.replace(/m/g, minutes.toString());

    // Replace seconds
    const seconds = now.getSeconds();
    dateStr = dateStr.replace(/ss/g, seconds.toString().padStart(2, '0'));
    dateStr = dateStr.replace(/s/g, seconds.toString());

    // Replace milliseconds
    const ms = now.getMilliseconds();
    dateStr = dateStr.replace(/zzz/g, ms.toString().padStart(3, '0'));
    dateStr = dateStr.replace(/z/g, ms.toString());

    return dateStr;
  });

  return result;
}
