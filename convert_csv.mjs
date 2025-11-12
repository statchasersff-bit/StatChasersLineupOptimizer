import fs from 'fs';
import Papa from 'papaparse';

// Read the input CSV
const inputCsv = fs.readFileSync('attached_assets/week11_1762990234698.csv', 'utf8');

// Parse the CSV
Papa.parse(inputCsv, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    // Transform each row to the expected format
    const transformedData = results.data.map(row => {
      return {
        sleeper_id: row.PID || '',
        name: row.Player || '',
        team: row.Team || '',
        pos: row.Pos || '',
        opp: row.Opp || '',
        proj: parseFloat(row.FFPts) || 0,
        pass_comp: parseFloat(row.Comp) || 0,
        pass_att: parseFloat(row['Pass Att']) || 0,
        pass_yd: parseFloat(row['Pass Yds']) || 0,
        pass_td: parseFloat(row['Pass TD']) || 0,
        pass_int: parseFloat(row.INT) || 0,
        rush_att: parseFloat(row['Rush Att']) || 0,
        rush_yd: parseFloat(row['Rush Yds']) || 0,
        rush_td: parseFloat(row['Rush TD']) || 0,
        rec: parseFloat(row.Rec) || 0,
        rec_yd: parseFloat(row['Rec Yds']) || 0,
        rec_td: parseFloat(row['Rec TD']) || 0,
        fum_lost: parseFloat(row.Fum) || 0,
        two_pt: 0,
        xpm: parseFloat(row.XP) || 0,
        xpa: parseFloat(row.XP) || 0,
        fgm_0_19: 0,
        fgm_20_29: 0,
        fgm_30_39: 0,
        fgm_40_49: 0,
        fgm_50p: 0,
        sacks: 0,
        defs_int: 0,
        defs_fum_rec: 0,
        defs_td: 0,
        safety: 0,
        blk_kick: 0,
        ret_td: 0,
        pts_allowed: 0
      };
    });

    // Convert to CSV
    const csv = Papa.unparse(transformedData);
    
    // Write to output file
    fs.writeFileSync('public/projections/2025/week11.csv', csv);
    console.log(`✅ Converted ${transformedData.length} rows successfully!`);
  }
});
