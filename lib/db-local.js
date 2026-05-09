import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize lowdb databases
const dbPath = join(__dirname, '../data');

// Profiles database
const profilesDbFile = new JSONFile(join(dbPath, 'profiles.json'));
const profilesDb = new Low(profilesDbFile);
await profilesDb.read();
profilesDb.data ||= { profiles: [] };

// Warnings database
const warningsDbFile = new JSONFile(join(dbPath, 'warnings.json'));
const warningsDb = new Low(warningsDbFile);
await warningsDb.read();
warningsDb.data ||= { warnings: [] };

// Admin control database
const adminDbFile = new JSONFile(join(dbPath, 'admin.json'));
const adminDb = new Low(adminDbFile);
await adminDb.read();
adminDb.data ||= { groups: [] };

// ==================== PROFILES ====================
export const ProfileDB = {
  async findOne(query) {
    await profilesDb.read();
    return profilesDb.data.profiles.find(p => 
      p.userId === query.userId && p.groupId === query.groupId
    );
  },

  async find(query) {
    await profilesDb.read();
    return profilesDb.data.profiles.filter(p => p.groupId === query.groupId);
  },

  async findOneAndUpdate(query, update, options = {}) {
    await profilesDb.read();
    let profile = profilesDb.data.profiles.find(p => 
      p.userId === query.userId && p.groupId === query.groupId
    );

    if (!profile && options.upsert) {
      profile = { ...query, ...update };
      profilesDb.data.profiles.push(profile);
    } else if (profile) {
      Object.assign(profile, update);
    }

    await profilesDb.write();
    return profile;
  },

  async deleteMany(query) {
    await profilesDb.read();
    const originalLength = profilesDb.data.profiles.length;
    profilesDb.data.profiles = profilesDb.data.profiles.filter(p => 
      p.groupId !== query.groupId
    );
    const deletedCount = originalLength - profilesDb.data.profiles.length;
    await profilesDb.write();
    return { deletedCount };
  },

  async deleteOne(query) {
    await profilesDb.read();
    const index = profilesDb.data.profiles.findIndex(p => 
      p.userId === query.userId && p.groupId === query.groupId
    );
    if (index !== -1) {
      profilesDb.data.profiles.splice(index, 1);
      await profilesDb.write();
    }
  }
};

// ==================== WARNINGS ====================
export const WarningDB = {
  async findOne(query) {
    await warningsDb.read();
    return warningsDb.data.warnings.find(w => 
      w.userId === query.userId && w.groupId === query.groupId
    );
  },

  async find(query) {
    await warningsDb.read();
    if (query.groupId) {
      return warningsDb.data.warnings.filter(w => w.groupId === query.groupId);
    }
    return warningsDb.data.warnings;
  },

  async findOneAndUpdate(query, update, options = {}) {
    await warningsDb.read();
    let warning = warningsDb.data.warnings.find(w => 
      w.userId === query.userId && w.groupId === query.groupId
    );

    if (!warning && options.upsert) {
      warning = { ...query, ...update, count: update.count || 0 };
      warningsDb.data.warnings.push(warning);
    } else if (warning) {
      Object.assign(warning, update);
    }

    await warningsDb.write();
    return warning;
  },

  async deleteMany(query) {
    await warningsDb.read();
    const originalLength = warningsDb.data.warnings.length;
    warningsDb.data.warnings = warningsDb.data.warnings.filter(w => 
      w.groupId !== query.groupId
    );
    const deletedCount = originalLength - warningsDb.data.warnings.length;
    await warningsDb.write();
    return { deletedCount };
  },

  async deleteOne(query) {
    await warningsDb.read();
    const index = warningsDb.data.warnings.findIndex(w => 
      w.userId === query.userId && w.groupId === query.groupId
    );
    if (index !== -1) {
      warningsDb.data.warnings.splice(index, 1);
      await warningsDb.write();
    }
  }
};

// ==================== ADMIN CONTROL ====================
export const AdminDB = {
  async findOne(query) {
    await adminDb.read();
    return adminDb.data.groups.find(g => g.groupId === query.groupId);
  },

  async findOneAndUpdate(query, update, options = {}) {
    await adminDb.read();
    let group = adminDb.data.groups.find(g => g.groupId === query.groupId);

    if (!group && options.upsert) {
      group = { ...query, ...update };
      adminDb.data.groups.push(group);
    } else if (group) {
      Object.assign(group, update);
    }

    await adminDb.write();
    return group;
  },

  async deleteOne(query) {
    await adminDb.read();
    const index = adminDb.data.groups.findIndex(g => g.groupId === query.groupId);
    if (index !== -1) {
      adminDb.data.groups.splice(index, 1);
      await adminDb.write();
    }
  }
};

export default { ProfileDB, WarningDB, AdminDB };
