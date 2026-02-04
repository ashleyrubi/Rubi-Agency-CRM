export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Complete';
export type UserStatus = 'Active' | 'Inactive' | 'On Leave';

export interface Lead {
  id?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  status: LeadStatus;
  value: number;
  source: string;
  expectedCloseDate?: string;
  notes?: string;
  closedAt?: any;
  lossReason?: string;
  createdAt: any;
  updatedAt: any;
}

export interface ClientContact {
  name: string;
  email: string;
  phone: string;
  jobRole: string;
}

export interface Client {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  contactPerson: string;
  status: 'Active' | 'Inactive';
  people?: ClientContact[];
  createdAt: any;
}

export interface Task {
  id?: string;
  clientId: string;
  project: string;
  briefCreatedRequired: string;     // Brief Created/Required
  contentRequiredReceived: string;  // Content Required and Received
  dateLogged: string;
  dateSent: string;
  dueDate: string;
  completeBy: string;
  inProgress: string;               // In Progress (Literal field)
  notes: string;
  who: string[];                    // Updated to array of strings
  versions: string;
  area: string;
  driveLink: string;                // Updated from linksToFiles
  hoursAllocated: number;
  createdAt: any;
}

export interface Staff {
  id?: string;
  employeeNumber?: string;
  name: string;
  email: string;
  role: string;
  jobRole: string;
  phone: string;
  status: UserStatus;
  department: string;
  joinedAt: any;
  // Link fields
  userId?: string;
  linked?: boolean;
  linkedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  staffId: string | null;
  linked: boolean;
  role: string;
  createdAt: any;
  updatedAt?: any;
}

export interface Freelancer {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  portfolioLink?: string;
  specialization: string;
  rate: string;
  status: UserStatus;
  joinedAt: any;
}

export interface FileMetadata {
  id?: string;
  name: string;
  url: string;
  type: string;
  size: number;
  clientId: string;
  uploadedAt: any;
  uploadedBy: string;
}