/**
 * Address formatting utilities
 */

export interface AddressFields {
  locationName?: string | null;
  streetAddress1?: string | null;
  streetAddress2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

/**
 * Formats address fields into a single-line display string
 * Example: "Grand Ballroom, 123 Main St, Austin, TX 78701"
 */
export function formatAddressOneLine(address: AddressFields): string {
  const parts: string[] = [];

  if (address.locationName) {
    parts.push(address.locationName);
  }

  // Build street address part
  const streetParts: string[] = [];
  if (address.streetAddress1) {
    streetParts.push(address.streetAddress1);
  }
  if (address.streetAddress2) {
    streetParts.push(address.streetAddress2);
  }
  if (streetParts.length > 0) {
    parts.push(streetParts.join(', '));
  }

  if (address.city) {
    parts.push(address.city);
  }

  // State and zip on same part
  const stateZip: string[] = [];
  if (address.state) {
    stateZip.push(address.state);
  }
  if (address.zipCode) {
    stateZip.push(address.zipCode);
  }
  if (stateZip.length > 0) {
    parts.push(stateZip.join(' '));
  }

  return parts.join(', ');
}

/**
 * Formats address fields into a multi-line display string
 * Example:
 *   "Grand Ballroom
 *    123 Main St
 *    Suite 100
 *    Austin, TX 78701"
 */
export function formatAddressMultiLine(address: AddressFields): string {
  const lines: string[] = [];

  if (address.locationName) {
    lines.push(address.locationName);
  }

  if (address.streetAddress1) {
    lines.push(address.streetAddress1);
  }

  if (address.streetAddress2) {
    lines.push(address.streetAddress2);
  }

  // City, State Zip
  const cityStateZip: string[] = [];
  if (address.city) {
    cityStateZip.push(address.city);
  }
  const stateZip: string[] = [];
  if (address.state) {
    stateZip.push(address.state);
  }
  if (address.zipCode) {
    stateZip.push(address.zipCode);
  }
  if (stateZip.length > 0) {
    if (cityStateZip.length > 0) {
      cityStateZip.push(stateZip.join(' '));
      lines.push(cityStateZip.join(', '));
    } else {
      lines.push(stateZip.join(' '));
    }
  } else if (cityStateZip.length > 0) {
    lines.push(cityStateZip.join(', '));
  }

  return lines.join('\n');
}

/**
 * Formats address for Google Maps URL encoding
 * Uses the street address for directions, or location name as fallback
 */
export function formatAddressForMaps(address: AddressFields): string {
  const parts: string[] = [];

  // For maps, prioritize physical address
  if (address.streetAddress1) {
    parts.push(address.streetAddress1);
  }
  if (address.streetAddress2) {
    parts.push(address.streetAddress2);
  }
  if (address.city) {
    parts.push(address.city);
  }
  if (address.state) {
    parts.push(address.state);
  }
  if (address.zipCode) {
    parts.push(address.zipCode);
  }

  // If we have a physical address, return it
  if (parts.length > 0) {
    return parts.join(', ');
  }

  // Fallback to location name only
  return address.locationName || '';
}

/**
 * Checks if any address field has a value
 */
export function hasAddress(address: AddressFields): boolean {
  return !!(
    address.locationName ||
    address.streetAddress1 ||
    address.streetAddress2 ||
    address.city ||
    address.state ||
    address.zipCode
  );
}

/**
 * Formats address for HTML email display
 * Returns HTML with line breaks
 */
export function formatAddressForEmail(address: AddressFields): string {
  const lines: string[] = [];

  if (address.locationName) {
    lines.push(address.locationName);
  }

  if (address.streetAddress1) {
    lines.push(address.streetAddress1);
  }

  if (address.streetAddress2) {
    lines.push(address.streetAddress2);
  }

  // City, State Zip
  const cityStateZip: string[] = [];
  if (address.city) {
    cityStateZip.push(address.city);
  }
  const stateZip: string[] = [];
  if (address.state) {
    stateZip.push(address.state);
  }
  if (address.zipCode) {
    stateZip.push(address.zipCode);
  }
  if (stateZip.length > 0) {
    if (cityStateZip.length > 0) {
      cityStateZip.push(stateZip.join(' '));
      lines.push(cityStateZip.join(', '));
    } else {
      lines.push(stateZip.join(' '));
    }
  } else if (cityStateZip.length > 0) {
    lines.push(cityStateZip.join(', '));
  }

  return lines.join('<br>');
}
