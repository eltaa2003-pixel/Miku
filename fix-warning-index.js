import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://itachi3mk:mypassis1199@cluster0.zzyxjo3.mongodb.net/?retryWrites=true&w=majority';

async function fixWarningIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('warnings');

    console.log('🔍 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

    // Drop the problematic unique index on userId if it exists
    const userIdIndex = indexes.find(idx => 
      idx.name === 'userId_1' || 
      (idx.key && idx.key.userId === 1 && !idx.key.groupId)
    );

    if (userIdIndex) {
      console.log('🗑️ Dropping problematic userId index:', userIdIndex.name);
      try {
        await collection.dropIndex(userIdIndex.name);
        console.log('✅ Successfully dropped userId index');
      } catch (dropError) {
        console.log('⚠️ Could not drop index (might not exist):', dropError.message);
      }
    }

    // Create the correct compound unique index
    console.log('🔧 Creating compound unique index on userId and groupId...');
    try {
      await collection.createIndex(
        { userId: 1, groupId: 1 }, 
        { unique: true, name: 'userId_groupId_unique' }
      );
      console.log('✅ Successfully created compound unique index');
    } catch (createError) {
      if (createError.code === 11000) {
        console.log('⚠️ Index already exists or there are duplicate records');
        
        // Find and log duplicate records
        console.log('🔍 Checking for duplicate records...');
        const duplicates = await collection.aggregate([
          {
            $group: {
              _id: { userId: "$userId", groupId: "$groupId" },
              count: { $sum: 1 },
              docs: { $push: "$_id" }
            }
          },
          {
            $match: { count: { $gt: 1 } }
          }
        ]).toArray();

        if (duplicates.length > 0) {
          console.log('🚨 Found duplicate records:', duplicates);
          
          // Merge duplicate records
          for (const duplicate of duplicates) {
            console.log(`🔧 Merging duplicates for userId: ${duplicate._id.userId}, groupId: ${duplicate._id.groupId}`);
            
            // Get all documents for this user/group combination
            const docs = await collection.find({
              userId: duplicate._id.userId,
              groupId: duplicate._id.groupId
            }).toArray();
            
            // Merge all warnings into the first document
            const firstDoc = docs[0];
            const allWarnings = [];
            
            docs.forEach(doc => {
              if (doc.warnings && Array.isArray(doc.warnings)) {
                allWarnings.push(...doc.warnings);
              }
            });
            
            // Sort warnings by date
            allWarnings.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Update the first document with all warnings
            await collection.updateOne(
              { _id: firstDoc._id },
              { $set: { warnings: allWarnings } }
            );
            
            // Delete the other duplicate documents
            const idsToDelete = docs.slice(1).map(doc => doc._id);
            if (idsToDelete.length > 0) {
              await collection.deleteMany({ _id: { $in: idsToDelete } });
              console.log(`✅ Deleted ${idsToDelete.length} duplicate documents`);
            }
          }
          
          // Try creating the index again
          await collection.createIndex(
            { userId: 1, groupId: 1 }, 
            { unique: true, name: 'userId_groupId_unique' }
          );
          console.log('✅ Successfully created compound unique index after merging duplicates');
        }
      } else {
        throw createError;
      }
    }

    // Verify the final indexes
    console.log('🔍 Final index verification...');
    const finalIndexes = await collection.indexes();
    console.log('Final indexes:', finalIndexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique })));

    console.log('✅ Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
fixWarningIndexes()
  .then(() => {
    console.log('🎉 Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });