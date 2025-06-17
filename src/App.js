import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Square, Users, Clock, Trophy, Crown, RotateCcw, ArrowUp, ArrowDown, Timer, Bell } from 'lucide-react';

const NextKickApp = () => {
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [matchDuration, setMatchDuration] = useState(5); // minutes
  const [gameMode, setGameMode] = useState('kingOfHill'); // winnerStays, overflow, kingOfHill
  const [overflowThreshold, setOverflowThreshold] = useState(6); // teams threshold for overflow mode
  const [fields, setFields] = useState([
    { id: 1, name: 'Field 1', currentMatch: null, queue: [], isActive: true },
    { id: 2, name: 'Field 2', currentMatch: null, queue: [], isActive: true },
    { id: 3, name: 'Field 3', currentMatch: null, queue: [], isActive: true }
  ]);
  const [globalQueue, setGlobalQueue] = useState([]);
  const [timers, setTimers] = useState({});
  const [timerEnded, setTimerEnded] = useState({});
  const [pendingResults, setPendingResults] = useState({}); // Store results before processing

  // Timer effect for all fields
  useEffect(() => {
    const intervals = {};
    
    fields.forEach(field => {
      if (field.currentMatch && timers[field.id] > 0) {
        intervals[field.id] = setInterval(() => {
          setTimers(prev => {
            const newTime = (prev[field.id] || 0) - 1;
            if (newTime <= 0) {
              // Time's up - mark as ended but don't auto-complete
              setTimerEnded(prevEnded => ({ ...prevEnded, [field.id]: true }));
              // Play audio notification if available
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjOR2/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEchzuI0+zNdi');
                audio.play().catch(() => {}); // Ignore errors if audio doesn't work
              } catch (e) {}
              return { ...prev, [field.id]: 0 };
            }
            return { ...prev, [field.id]: newTime };
          });
        }, 1000);
      }
    });

    return () => {
      Object.values(intervals).forEach(interval => clearInterval(interval));
    };
  }, [fields, timers]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addTeam = () => {
    if (newTeamName.trim() && !teams.find(t => t.name === newTeamName.trim())) {
      const newTeam = {
        id: Date.now(),
        name: newTeamName.trim(),
        wins: 0,
        losses: 0,
        draws: 0
      };
      setTeams(prev => [...prev, newTeam]);
      setGlobalQueue(prev => [...prev, newTeam]);
      setNewTeamName('');
    }
  };

  const toggleField = (fieldId) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, isActive: !field.isActive } : field
    ));
  };

  const getActiveFields = () => fields.filter(f => f.isActive).sort((a, b) => a.id - b.id);

  const getNextAvailableTeams = () => {
    // Get teams not currently playing on any field
    const playingTeams = new Set();
    fields.forEach(field => {
      if (field.currentMatch) {
        playingTeams.add(field.currentMatch.team1.id);
        playingTeams.add(field.currentMatch.team2.id);
      }
    });
    
    return globalQueue.filter(team => !playingTeams.has(team.id));
  };

  const getCurrentGameMode = () => {
    if (gameMode === 'overflow' && teams.length >= overflowThreshold) {
      return 'overflow';
    }
    return gameMode; // kingOfHill, winnerStays, or overflow
  };

  const getNextFieldForWinner = (currentFieldId) => {
    const currentMode = getCurrentGameMode();
    
    if (currentMode === 'overflow') {
      return "back of queue"; // In overflow mode, winner goes to back of queue
    }
    
    if (currentMode === 'winnerStays') {
      // In winner stays mode, winner stays on the same field
      return fields.find(f => f.id === currentFieldId)?.name || '';
    }
    
    if (currentMode === 'kingOfHill') {
      // In king of the hill mode with field hierarchy
      const activeFields = getActiveFields();
      const currentFieldIndex = activeFields.findIndex(f => f.id === currentFieldId);
      
      if (currentFieldIndex === -1) return "back of queue";
      
      // If this is the highest field (last in array), winner stays
      if (currentFieldIndex === activeFields.length - 1) {
        return activeFields[currentFieldIndex].name;
      }
      
      // Otherwise, winner moves up to next field
      const nextField = activeFields[currentFieldIndex + 1];
      return nextField ? nextField.name : "back of queue";
    }
    
    return "back of queue";
  };

  const startMatch = (fieldId) => {
    const availableTeams = getNextAvailableTeams();
    if (availableTeams.length >= 2) {
      const [team1, team2] = availableTeams.slice(0, 2);
      
      setFields(prev => prev.map(field => 
        field.id === fieldId ? {
          ...field,
          currentMatch: {
            team1: { ...team1, score: 0 },
            team2: { ...team2, score: 0 },
            startTime: Date.now()
          }
        } : field
      ));
      
      // Remove teams from global queue
      setGlobalQueue(prev => prev.filter(team => team.id !== team1.id && team.id !== team2.id));
      
      // Start timer for this field and clear any previous timer ended state
      setTimers(prev => ({ ...prev, [fieldId]: matchDuration * 60 }));
      setTimerEnded(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const startAllMatches = () => {
    const activeFields = getActiveFields();
    const availableTeams = getNextAvailableTeams();
    
    if (availableTeams.length < activeFields.length * 2) {
      alert(`Need ${activeFields.length * 2} teams to start all fields. Currently have ${availableTeams.length} available teams.`);
      return;
    }
    
    let teamIndex = 0;
    activeFields.forEach(field => {
      if (!field.currentMatch && teamIndex + 1 < availableTeams.length) {
        const team1 = availableTeams[teamIndex];
        const team2 = availableTeams[teamIndex + 1];
        teamIndex += 2;
        
        setFields(prev => prev.map(f => 
          f.id === field.id ? {
            ...f,
            currentMatch: {
              team1: { ...team1, score: 0 },
              team2: { ...team2, score: 0 },
              startTime: Date.now()
            }
          } : f
        ));
        
        // Start timer for this field
        setTimers(prev => ({ ...prev, [field.id]: matchDuration * 60 }));
        setTimerEnded(prev => ({ ...prev, [field.id]: false }));
      }
    });
    
    // Remove used teams from global queue
    const usedTeams = availableTeams.slice(0, teamIndex);
    setGlobalQueue(prev => prev.filter(team => 
      !usedTeams.some(usedTeam => usedTeam.id === team.id)
    ));
  };

  const extendTime = (fieldId, minutes) => {
    setTimers(prev => ({ ...prev, [fieldId]: (prev[fieldId] || 0) + (minutes * 60) }));
    setTimerEnded(prev => ({ ...prev, [fieldId]: false }));
  };

  // Process all pending results in the correct order
  const processAllPendingResults = () => {
    const currentMode = getCurrentGameMode();
    
    if (currentMode === 'winnerStays') {
      // For Winner Stays mode: winners stay on their fields, losers go to back of queue
      const losersToQueue = [];
      const fieldWinners = {}; // Store winners for each field
      
      Object.keys(pendingResults).forEach(fieldId => {
        const { result, team1, team2 } = pendingResults[fieldId];
        
        let winner, loser;
        if (result === 'draw') {
          winner = team2; // Challenger wins on tie
          loser = team1;
        } else {
          winner = result === 'team1' ? team1 : team2;
          loser = result === 'team1' ? team2 : team1;
        }
        
        // Update team stats
        updateTeamStats(team1, team2, result);
        
        // Store winner for this field (they'll stay and defend)
        fieldWinners[fieldId] = winner;
        
        // Loser goes to back of queue
        losersToQueue.push(loser);
      });
      
      // Update fields: put winners back on their fields for next match
      setFields(prev => prev.map(field => {
        if (fieldWinners[field.id]) {
          return {
            ...field,
            currentMatch: null, // Clear current match, winner will be first to play next
            defendingTeam: fieldWinners[field.id] // Mark who's defending this field
          };
        }
        return { ...field, currentMatch: null };
      }));
      
      // Add losers to back of global queue
      setGlobalQueue(prev => [...prev, ...losersToQueue]);
      
      // For winner stays, we need to modify the startMatch function to prioritize defending teams
      // This will be handled in the modified startMatch function below
      
    } else if (currentMode === 'kingOfHill') {
      // Original King of Hill logic
      const allWinners = [];
      const allLosers = [];
      const activeFields = getActiveFields();
      
      activeFields.forEach(field => {
        if (pendingResults[field.id]) {
          const { result, team1, team2 } = pendingResults[field.id];
          
          let winner, loser;
          if (result === 'draw') {
            winner = team2; // Challenger wins
            loser = team1;
          } else {
            winner = result === 'team1' ? team1 : team2;
            loser = result === 'team1' ? team2 : team1;
          }
          
          updateTeamStats(team1, team2, result);
          
          const fieldIndex = activeFields.findIndex(f => f.id === field.id);
          if (fieldIndex === activeFields.length - 1) {
            allWinners.unshift(winner);
          } else {
            allWinners.unshift(winner);
          }
          
          allLosers.push(loser);
        }
      });
      
      setGlobalQueue(prev => [...allWinners, ...prev, ...allLosers]);
      setFields(prev => prev.map(field => ({ ...field, currentMatch: null, defendingTeam: null })));
      
    } else if (currentMode === 'overflow') {
      // Original Overflow logic
      const allLosers = [];
      Object.keys(pendingResults).forEach(fieldId => {
        const { result, team1, team2 } = pendingResults[fieldId];
        updateTeamStats(team1, team2, result);
        allLosers.push(team1, team2);
      });
      
      setGlobalQueue(prev => [...prev, ...allLosers]);
      setFields(prev => prev.map(field => ({ ...field, currentMatch: null, defendingTeam: null })));
    }
    
    // Clear all pending results and timers
    setPendingResults({});
    setTimers({});
    setTimerEnded({});
  };

  // Modified startMatch for Winner Stays mode
  const startMatchWithDefender = (fieldId) => {
    const field = fields.find(f => f.id === fieldId);
    const currentMode = getCurrentGameMode();
    
    if (currentMode === 'winnerStays' && field?.defendingTeam) {
      // Winner Stays mode: defending team vs next challenger
      const availableTeams = getNextAvailableTeams();
      if (availableTeams.length >= 1) {
        const challenger = availableTeams[0];
        
        setFields(prev => prev.map(f => 
          f.id === fieldId ? {
            ...f,
            currentMatch: {
              team1: { ...field.defendingTeam, score: 0 }, // Defender
              team2: { ...challenger, score: 0 }, // Challenger
              startTime: Date.now()
            },
            defendingTeam: null // Clear defending team
          } : f
        ));
        
        // Remove challenger from global queue
        setGlobalQueue(prev => prev.filter(team => team.id !== challenger.id));
        
        // Start timer
        setTimers(prev => ({ ...prev, [fieldId]: matchDuration * 60 }));
        setTimerEnded(prev => ({ ...prev, [fieldId]: false }));
      }
    } else {
      // Normal match start for other modes or first matches
      startMatch(fieldId);
    }
  };

  const updateTeamStats = (team1, team2, result) => {
    setTeams(prevTeams => prevTeams.map(team => {
      if (team.id === team1.id) {
        if (result === 'team1') return { ...team, wins: team.wins + 1 };
        if (result === 'team2') return { ...team, losses: team.losses + 1 };
        return { ...team, draws: team.draws + 1 };
      }
      if (team.id === team2.id) {
        if (result === 'team2') return { ...team, wins: team.wins + 1 };
        if (result === 'team1') return { ...team, losses: team.losses + 1 };
        return { ...team, draws: team.draws + 1 };
      }
      return team;
    }));
  };

  const handleMatchEnd = useCallback((fieldId, result) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field?.currentMatch) return;

    const { team1, team2 } = field.currentMatch;
    
    // Store the result instead of processing immediately
    setPendingResults(prev => ({
      ...prev,
      [fieldId]: { result, team1, team2 }
    }));
  }, [fields]);

  // Check if all expired timers have results selected
  const allResultsSelected = () => {
    const expiredFields = fields.filter(field => 
      field.currentMatch && timerEnded[field.id]
    );
    
    return expiredFields.every(field => pendingResults[field.id]);
  };

  const resetApp = () => {
    setTeams([]);
    setGlobalQueue([]);
    setFields(prev => prev.map(field => ({ ...field, currentMatch: null, defendingTeam: null })));
    setTimers({});
    setTimerEnded({});
    setPendingResults({});
  };

  const shuffleQueue = () => {
    const shuffled = [...globalQueue].sort(() => Math.random() - 0.5);
    setGlobalQueue(shuffled);
  };

  const moveTeamInQueue = (teamId, direction) => {
    const currentIndex = globalQueue.findIndex(team => team.id === teamId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= globalQueue.length) return;
    
    const newQueue = [...globalQueue];
    [newQueue[currentIndex], newQueue[newIndex]] = [newQueue[newIndex], newQueue[currentIndex]];
    setGlobalQueue(newQueue);
  };

  const getGameModeDescription = () => {
    const currentMode = getCurrentGameMode();
    switch (currentMode) {
      case 'overflow':
        return {
          title: 'Overflow Mode (Active)',
          rules: [
            '• Both teams rotate to back of queue',
            '• Ensures equal playing time for all',
            '• No team defends when many players present',
            `• Active when ${overflowThreshold}+ teams present`
          ]
        };
      case 'winnerStays':
        return {
          title: 'Winner Stays Format (Active)',
          rules: [
            '• Winner stays on field to defend against next team',
            '• Loser goes to back of queue',
            '• If tied: challenger (newest team) wins',
            '• Winners keep defending until they lose',
            '• Staff declares winner when time ends'
          ]
        };
      default: // kingOfHill
        return {
          title: 'King of the Hill Format',
          rules: [
            '• Winner moves up field hierarchy',
            '• Loser goes to back of queue',
            '• If tied: challenger wins and moves up',
            '• Top field winner stays (defends crown)',
            '• Staff declares winner when time ends'
          ]
        };
    }
  };

  const modeInfo = getGameModeDescription();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Trophy className="text-yellow-300" size={40} />
            Winner Stays - Kraemer Fields
          </h1>
          <p className="text-white/80">Staff Timer-Based Management System</p>
          <p className="text-white/60 text-sm mt-1">Time-based matches • Staff declares winners • Pure timer management</p>
        </div>

        {/* Process All Results Button - Show when multiple fields have timers ended */}
        {Object.keys(pendingResults).length > 0 && (
          <div className="mt-6 text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 inline-block">
              <div className="text-white mb-3">
                <div className="font-semibold">
                  {Object.keys(pendingResults).length} field(s) awaiting processing
                </div>
                <div className="text-sm text-white/70">
                  {allResultsSelected() 
                    ? "All winners selected - ready to process" 
                    : "Select winners from all expired fields before processing"
                  }
                </div>
              </div>
              <button
                onClick={processAllPendingResults}
                disabled={!allResultsSelected()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold"
              >
                Process All Results
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Team Registration & Controls */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Users size={20} />
              Team Management
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTeam()}
                  placeholder="Enter team name"
                  className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  onClick={addTeam}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <label className="text-white/80 text-sm flex items-center gap-2">
                    <Clock size={16} />
                    Match Duration:
                  </label>
                  <input
                    type="number"
                    value={matchDuration}
                    onChange={(e) => setMatchDuration(Number(e.target.value))}
                    min="1"
                    max="20"
                    className="w-16 px-2 py-1 bg-white/20 border border-white/30 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <span className="text-white/80 text-sm">min</span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <label className="text-white/80 text-sm">Game Mode:</label>
                    <select
                      value={gameMode}
                      onChange={(e) => setGameMode(e.target.value)}
                      className="px-3 py-1 bg-white/20 border border-white/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      <option value="kingOfHill" className="bg-gray-800">King of the Hill</option>
                      <option value="winnerStays" className="bg-gray-800">Winner Stays</option>
                      <option value="overflow" className="bg-gray-800">Overflow</option>
                    </select>
                  </div>
                  
                  {gameMode === 'overflow' && (
                    <div className="flex gap-2 items-center">
                      <label className="text-white/80 text-xs">Threshold:</label>
                      <input
                        type="number"
                        value={overflowThreshold}
                        onChange={(e) => setOverflowThreshold(Number(e.target.value))}
                        min="4"
                        max="20"
                        className="w-12 px-1 py-1 bg-white/20 border border-white/30 rounded text-white text-center text-xs focus:outline-none focus:ring-2 focus:ring-white/50"
                      />
                      <span className="text-white/80 text-xs">teams</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white/80 text-sm">Active Fields:</label>
                <div className="flex gap-2">
                  {fields.map(field => (
                    <button
                      key={field.id}
                      onClick={() => toggleField(field.id)}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        field.isActive 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-500 text-white/70'
                      }`}
                    >
                      {field.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={shuffleQueue}
                  disabled={globalQueue.length < 2}
                  className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw size={16} />
                  Shuffle
                </button>
                <button
                  onClick={resetApp}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={startAllMatches}
                disabled={(() => {
                  const activeFields = getActiveFields();
                  const availableTeams = getNextAvailableTeams();
                  const fieldsWithoutMatches = activeFields.filter(f => !f.currentMatch);
                  
                  // For winner stays mode, we need different logic
                  if (getCurrentGameMode() === 'winnerStays') {
                    const fieldsNeedingChallengers = activeFields.filter(f => !f.currentMatch && f.defendingTeam);
                    const fieldsNeedingFullMatch = activeFields.filter(f => !f.currentMatch && !f.defendingTeam);
                    
                    return availableTeams.length < (fieldsNeedingChallengers.length + fieldsNeedingFullMatch.length * 2);
                  }
                  
                  return availableTeams.length < fieldsWithoutMatches.length * 2;
                })()}
                className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
              >
                <Play size={20} />
                Start All Fields
              </button>
            </div>

            {/* Team List */}
            <div className="mt-4">
              <h3 className="text-white font-medium mb-2">Teams ({teams.length})</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {teams.map(team => (
                  <div key={team.id} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-white font-medium text-sm">{team.name}</span>
                    <span className="text-white/70 text-xs">
                      {team.wins}W-{team.losses}L-{team.draws}D
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fields */}
          {getActiveFields().map((field, index) => {
            const isTimeUp = timerEnded[field.id];
            const isWinnerStays = getCurrentGameMode() === 'winnerStays';
            return (
              <div key={field.id} className={`backdrop-blur-md rounded-xl p-6 border ${
                isTimeUp 
                  ? 'bg-red-500/20 border-red-400 animate-pulse' 
                  : 'bg-white/10 border-white/20'
              }`}>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  {isTimeUp ? <Bell size={20} className="text-red-400" /> : <Timer size={20} />}
                  {field.name}
                  {isTimeUp && (
                    <span className="text-xs bg-red-500 px-2 py-1 rounded text-white animate-pulse">
                      TIME UP!
                    </span>
                  )}
                  {!isTimeUp && getCurrentGameMode() === 'overflow' && field.currentMatch && (
                    <span className="text-xs bg-purple-500 px-2 py-1 rounded text-white">OVERFLOW</span>
                  )}
                  {!isTimeUp && isWinnerStays && field.currentMatch && (
                    <span className="text-xs bg-green-500 px-2 py-1 rounded text-white">WINNER STAYS</span>
                  )}
                  {!isTimeUp && isWinnerStays && field.defendingTeam && !field.currentMatch && (
                    <span className="text-xs bg-yellow-500 px-2 py-1 rounded text-black">DEFENDING</span>
                  )}
                </h2>

                {/* Show defending team info for Winner Stays mode */}
                {isWinnerStays && field.defendingTeam && !field.currentMatch && (
                  <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-400 rounded-lg">
                    <div className="text-yellow-400 font-semibold text-sm mb-1">🏆 DEFENDING FIELD</div>
                    <div className="text-white font-medium">{field.defendingTeam.name}</div>
                    <div className="text-white/70 text-xs">Waiting for challenger...</div>
                  </div>
                )}

                {field.currentMatch ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className={`text-3xl font-bold mb-2 ${
                        isTimeUp ? 'text-red-400' : 
                        timers[field.id] <= 60 ? 'text-yellow-400' : 'text-white'
                      }`}>
                        {formatTime(timers[field.id] || 0)}
                      </div>
                      <div className="text-white/70 text-sm">
                        {isTimeUp ? 'Time Ended - Declare Winner' : 'Time Remaining'}
                      </div>
                    </div>

                    <div className="text-center mb-4">
                      <div className="text-2xl font-bold text-white mb-1">
                        {field.currentMatch.team1.name} vs {field.currentMatch.team2.name}
                      </div>
                      <div className="text-white/60 text-sm">
                        {isWinnerStays ? 
                          `${field.currentMatch.team1.name} (Defender) vs ${field.currentMatch.team2.name} (Challenger)` : 
                          'Match in Progress'
                        }
                      </div>
                    </div>

                    {/* Timer Controls - Only show when timer is running */}
                    {!isTimeUp && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <button
                          onClick={() => extendTime(field.id, 1)}
                          className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors text-xs"
                        >
                          +1 Min
                        </button>
                        <button
                          onClick={() => extendTime(field.id, 2)}
                          className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors text-xs"
                        >
                          +2 Min
                        </button>
                        <button
                          onClick={() => extendTime(field.id, 5)}
                          className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors text-xs"
                        >
                          +5 Min
                        </button>
                      </div>
                    )}

                    {/* Winner Declaration - Only show when time is up */}
                    {isTimeUp && (
                      <div className="space-y-3">
                        <div className="text-center text-yellow-400 text-sm font-semibold">
                          ⚠️ TIME UP - SELECT WINNER ⚠️
                        </div>
                        <div className={`grid grid-cols-3 gap-2 ${!pendingResults[field.id] ? 'animate-pulse' : ''}`}>
                          <button
                            onClick={() => handleMatchEnd(field.id, 'team1')}
                            disabled={!!pendingResults[field.id]}
                            className={`px-3 py-3 text-white rounded-lg transition-colors text-sm font-medium ${
                              pendingResults[field.id]?.result === 'team1' 
                                ? 'bg-green-800 border-2 border-green-400' 
                                : pendingResults[field.id] 
                                  ? 'bg-gray-600 opacity-50' 
                                  : 'bg-green-600 hover:bg-green-700 border-2 border-green-400'
                            }`}
                          >
                            {field.currentMatch.team1.name} Wins
                            {isWinnerStays && <div className="text-xs">(Defender)</div>}
                          </button>
                          <button
                            onClick={() => handleMatchEnd(field.id, 'draw')}
                            disabled={!!pendingResults[field.id]}
                            className={`px-3 py-3 text-white rounded-lg transition-colors text-sm font-medium ${
                              pendingResults[field.id]?.result === 'draw' 
                                ? 'bg-orange-800 border-2 border-orange-400' 
                                : pendingResults[field.id] 
                                  ? 'bg-gray-600 opacity-50' 
                                  : 'bg-orange-600 hover:bg-orange-700 border-2 border-orange-400'
                            }`}
                          >
                            Tie - Challenger Wins
                            <div className="text-xs">({field.currentMatch.team2.name})</div>
                          </button>
                          <button
                            onClick={() => handleMatchEnd(field.id, 'team2')}
                            disabled={!!pendingResults[field.id]}
                            className={`px-3 py-3 text-white rounded-lg transition-colors text-sm font-medium ${
                              pendingResults[field.id]?.result === 'team2' 
                                ? 'bg-green-800 border-2 border-green-400' 
                                : pendingResults[field.id] 
                                  ? 'bg-gray-600 opacity-50' 
                                  : 'bg-green-600 hover:bg-green-700 border-2 border-green-400'
                            }`}
                          >
                            {field.currentMatch.team2.name} Wins
                            {isWinnerStays && <div className="text-xs">(Challenger)</div>}
                          </button>
                        </div>
                        {pendingResults[field.id] && (
                          <div className="text-center text-green-400 text-xs font-semibold">
                            ✓ Winner Selected - Waiting for other fields
                          </div>
                        )}
                      </div>
                    )}

                    {isTimeUp && (
                      <div className="text-center text-yellow-400 text-sm font-semibold mt-3">
                        {(() => {
                          const currentMode = getCurrentGameMode();
                          const nextField = getNextFieldForWinner(field.id);
                          
                          if (currentMode === 'overflow') {
                            return "Winner and loser both go to back of queue";
                          } else if (currentMode === 'winnerStays') {
                            return "Winner stays on this field • Loser goes to back of queue";
                          } else if (currentMode === 'kingOfHill') {
                            if (nextField === field.name) {
                              return `Winner stays on ${field.name} • Loser goes to back of queue`;
                            } else {
                              return `Winner moves to ${nextField} • Loser goes to back of queue`;
                            }
                          }
                          return "";
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-white/60 mb-4 text-sm">
                      {isWinnerStays && field.defendingTeam 
                        ? `${field.defendingTeam.name} is defending - need challenger`
                        : 'No active match'
                      }
                    </div>
                    <button
                      onClick={() => startMatchWithDefender(field.id)}
                      disabled={(() => {
                        if (isWinnerStays && field.defendingTeam) {
                          return getNextAvailableTeams().length < 1;
                        }
                        return getNextAvailableTeams().length < 2;
                      })()}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto text-sm"
                    >
                      <Play size={16} />
                      {isWinnerStays && field.defendingTeam 
                        ? 'Challenge Defender'
                        : 'Start Timed Match'
                      }
                    </button>
                    {(() => {
                      if (isWinnerStays && field.defendingTeam) {
                        return getNextAvailableTeams().length < 1 && (
                          <div className="text-white/60 text-xs mt-2">
                            Need 1+ challenger team
                          </div>
                        );
                      }
                      return getNextAvailableTeams().length < 2 && (
                        <div className="text-white/60 text-xs mt-2">
                          Need 2+ available teams
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {/* Queue Display */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Crown size={20} />
              Global Queue ({globalQueue.length})
            </h2>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {globalQueue.length === 0 ? (
                <div className="text-white/60 text-center py-4 text-sm">
                  Queue is empty
                </div>
              ) : (
                globalQueue.map((team, index) => (
                  <div
                    key={`${team.id}-${index}`}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      index === 0 ? 'bg-yellow-500/30 border border-yellow-400' :
                      index === 1 ? 'bg-green-500/30 border border-green-400' :
                      'bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-400 text-black' :
                        index === 1 ? 'bg-green-400 text-black' :
                        'bg-white/20 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="text-white font-medium text-sm">{team.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {index === 0 && (
                        <span className="text-yellow-400 text-xs font-semibold mr-2">
                          NEXT
                        </span>
                      )}
                      {index === 1 && (
                        <span className="text-green-400 text-xs font-semibold mr-2">
                          READY
                        </span>
                      )}
                      
                      {/* Queue management buttons */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveTeamInQueue(team.id, 'up')}
                          disabled={index === 0}
                          className="p-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => moveTeamInQueue(team.id, 'down')}
                          disabled={index === globalQueue.length - 1}
                          className="p-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Game Mode Info */}
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <div className="text-white/80 text-sm">
                <strong className={getCurrentGameMode() === 'overflow' ? 'text-purple-400' : getCurrentGameMode() === 'winnerStays' ? 'text-green-400' : ''}>
                  {modeInfo.title}
                </strong>
                <ul className="mt-1 text-xs space-y-1">
                  {modeInfo.rules.map((rule, index) => (
                    <li key={index}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NextKickApp;
